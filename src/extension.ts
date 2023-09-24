import * as vscode from 'vscode';

// For brevity, display `message`.
function warn(message: string)
{
  vscode.window.showInformationMessage(message);
}

// To make it easy to disable console logging.
function log(message: string)
{
  console.log(message);
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

  log("Starting");

  // We build a list of edits.
  let edits: { erasure: vscode.Range; replacement: string }[] = [];

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
    log(`Found line: ${line}`);

    // Figure out where the cursor is within that isolated line.
    const cursor = selection.active.character - lineRange.start.character;
    log(`Found pos : ` + " ".repeat(cursor) + "█");

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
      log(`Already have ${key}`);
      continue;
    }

    // Add it to our index of regions we're planning to erase.
    log(`Found region at ${key}`);
    already.add(key);

    // We replace that erasure region put that back together with a single space
    // character, unless the cursor is at the start or end of the line, or we
    // removed the entire prefix.  (Note that we've deleted any whitespace that
    // was sitting under the cursor.)
    const replacement = 
      (cursor === 0 || prefix.length === 0 || cursor === lineRange.end.character)
      ? ""
      : " "; 

    // Save those to do in a moment.
    edits.push({erasure, replacement});
  }

  // Perform all the edits at once by running all of the saved functions.
  editor.edit(
    edit => edits.forEach(args => {
      edit.replace(args.erasure, args.replacement);
    })
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
      // The cursor at _least_ at the start of the erasure range that we just
      // replaces, so the TextEditor adjusted its position for us to the end of
      // the replacement text, which is either empty or a space.  We want to be
      // at the _beginning_ of that replacement text, so if the replacement is
      // of non-zero size, move it back one space.
      //
      // TODO:
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

  //   // Now that the cursor is in the right place, replace the line.
  //   editor.edit(edit => edit.replace(lineRange, replacement));

  //   // Remember that new cursor in a replacement selections array.
  //   newSelections.push(
  //     new vscode.Selection(
  //       // This eliminates any selection region by putting the anchor and active
  //       // positions in the same place.
  //       newCursorPosition,
  //       newCursorPosition
  //     )
  //   );
  // }

  // // And set the new cursor positions.
  // editor.selections = newSelections;
}

// Activation hook.
export function activate(context: vscode.ExtensionContext) 
{
  log("HELLO THERE");

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
