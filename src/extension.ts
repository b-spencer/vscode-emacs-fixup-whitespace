import * as vscode from 'vscode';

// For brevity, display `message`.
function warn(message: string)
{
  vscode.window.showInformationMessage(message);
}

// The command itself.
function fixupWhitespace() 
{
  // Get the current editor.
  const editor = vscode.window.activeTextEditor;
  if(editor === null || editor === undefined)
  {
    // There isn't one?
    warn("Can't fixup-whitespace without active editor!");
    return;
  }

  // We build a list of edits.
  let edits: {
    // The range we need to erase.
    erasure: vscode.Range; 

    // The replacement (either empty or a single space).
    replacement: string;
  }[] = [];

  // We build an index of whitespace erasure regions so that we can detect when
  // multiple cursors are sitting in the same regions.  
  //
  // The value in this set is the Position of the start of the erasure.  Note
  // that if two cursors start in the same whitespace region, then they will
  // identify the same region, and thus find the same start, so that's all we
  // need to index.
  //
  // When we find a subsequent cursor in the same region, we skip it _and_ end
  // up removing it from the set of cursors.  After all, it has lost its unique
  // position by our operation!
  //
  // *sigh* TypeScript doesn't allow its Set's comparison operation to be
  // customized, so we do the simplest thing and build a (*yuck*) string key
  // that maps 1:1 with each value.
  //
  let already = new Set<string>();

  // We support multiple cursors.  Iterator over them all.
  for(let selection of editor.selections)
  {
    // Get the range of the current line.
    const lineRange = editor.document.lineAt(selection.active.line).range;

    // Flatten the line so we can operate on it simply.
    const line = editor.document.lineAt(lineRange.start).text;
    //console.log(`Found line: ${line}`);

    // Figure out where the cursor is within that isolated line.
    const cursor = selection.active.character - lineRange.start.character;
    //console.log(`Found pos : ` + " ".repeat(cursor) + "█");

    // Split the line at the cursor.
    const prefix = line.substring(0, cursor);
    const suffix = line.substring(cursor);
    
    // Trim all whitespace before, and at-and-after the cursor.
    //
    // It's okay if there is no whitespace here.
    //
    // By using trimEnd(), we're expanding the set of whitespace beyond what
    // Emacs will look for, but that Emacs function predates Unicode.  So this
    // is probably an improvement.  
    //
    // We could _just_ scan for the whitespace instead of making a new string,
    // but Typescript doesn't offer a builtin (non-regex) "is this character
    // considered whitespace" function, we don't want to impose a (wrong)
    // definition of what a "character" is, and this is fast enough for an
    // interactive keystroke.
    //
    const prefixTrimSize = prefix.length - prefix.trimEnd().length;
    const suffixTrimSize = suffix.length - suffix.trimStart().length;

    // Figure out the erasure region from the cursor's position and those left
    // and right trim sizes.  It is okay if this is empty.
    const erasure = new vscode.Range(
      selection.active.translate(0, -prefixTrimSize),
      selection.active.translate(0, suffixTrimSize)
    );

    // Form an indexing key for this erasure range based on its start position.
    const key = `${erasure.start.line}:${erasure.start.character}`;

    // Do we already know this range?  We do if we already indexed its start
    // position.
    if(already.has(key))
    {
      // Yes.  Skip it.
      //console.log(`Already have ${key}`);
      continue;
    }

    // Add it to our index of regions we're planning to erase.
    //console.log(`Found region at ${key}`);
    already.add(key);

    // We replace that erasure region put that back together with a single space
    // character, unless the cursor is at the start or end of the line, or we
    // removed the entire prefix.  (Note that we've deleted any whitespace that
    // was sitting under the cursor.)
    const replacement = 
      (cursor === 0
       || cursor === lineRange.end.character
       || prefixTrimSize === prefix.length)       
      ? ""
      : " "; 

    // Save those to do in a moment.
    edits.push({erasure, replacement, prefixTrimSize});
  }

  // Perform all the edits at once by running all of the saved functions.
  editor.edit(
    edit => edits.forEach(
      // Replace the spaces (maybe empty) with our replacement (maybe empty, but
      // not at the same time that `erasure` is empty).
      args => { edit.replace(args.erasure, args.replacement); }
    )
  )
  .then(
    // onFullfilled.
    success => {
      // Did it work?
      if(!success)
      {
        // No.  Just complain about it generically, since that's all we know.
        vscode.window.showWarningMessage("Edit failed");
        return;
      }

      // Yes.  Consider whether we need to adjust the cursor.
      //
      // The cursor was at _least_ at the start of the erasure range that we
      // just replaced.  When the cursor was _after_ the start of the erasure
      // range (i.e. within it), the TextEditor adjusted its position for us to
      // the end of the replacement text.
      //
      // We want to be at the _beginning_ of that replacement text (even if that
      // replacement text was empty), so if we replaced more than one space with
      // one space (vs. nothing), then move it back that one space so the cursor
      // is sitting on it.
      //
      // To adjust individual cursor positions, we must set them all.  So we do.
      //
      // But first, do we properly know how many selections (cursors) there are?
      if(editor.selections.length !== edits.length)
      {
        // No.  Oh.  Better leave the cursors alone then.  At least mention this
        // to the user.
        vscode.window.showInformationMessage(
          `Not adjusting cursors: saw ${editor.selections.length} expected `
          + edits.length
        );
        return;
      }

      // Looks good.  Let's build the new list by building a new selections
      // array containing adjusted values from the old list.  
      //
      // We need to make a new array because `editor.selections` is readonly.
      // And the simplest way to do that is to just make new Selection objects.
      // 
      let newSelections: vscode.Selection[] = [];
      for(let i = 0; i < editor.selections.length; ++i)
      {
        newSelections.push(
          new vscode.Selection(
            // Leave the anchor unchanged.
            editor.selections[i].anchor,

            // Adjust the active position as needed.
            editor.selections[i].active.translate(
              // Same line.
              0,
              // Move the cursor iff we erased more than 1 space . . .
              (edits[i].erasure.end.character 
                - edits[i].erasure.start.character) > 1
              // . . . and we actually inserted anything.
              ? -(edits[i].replacement.length)
              : 0
            )
          )
        );
      }
      
      // Set 'em all at once.
      editor.selections = newSelections;
    },

    // onRejected.
    reason => {
      // Assume it's because of overlapping regions.
      vscode.window.showWarningMessage(
        // The user can see our extension identity if they want to, but we
        // repeat it here so it's clearer what is going on.
        "fixup-whitespace: Unsupported edit: " + reason
        );
    }
  );
}

// Activation hook.
export function activate(context: vscode.ExtensionContext) 
{
  // Define the command mappings.
	let disposable = vscode.commands.registerCommand(
    'emacs-fixup-whitespace.fixupWhitespace', 
    () => { fixupWhitespace(); }
	);

  // Provide the commands to the context.
	context.subscriptions.push(disposable);
}

// No-op.
export function deactivate() 
{}
