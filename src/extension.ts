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

  console.log("HELLO");

  // We'll be building a list of edits.
  let edits: { erasure: vscode.Range; replacement: string }[] = [];

  // We support multiple cursors.  Iterator over them all.
  for(let selection of editor.selections)
  {
    // Get the range of the current line.
    const lineRange = editor.document.lineAt(selection.active.line).range;

    // Flatten the line so we can operate on it simply.
    const line = editor.document.lineAt(lineRange.start).text;
    console.log(`Found line: ${line}`);

    // Figure out where the cursor is within that isolated line.
    const cursor = selection.active.character - lineRange.start.character;
    console.log(`Found pos : ` + " ".repeat(cursor) + "█");

    // Split the line at the cursor.
    const prefix = line.substring(0, cursor);
    const suffix = line.substring(cursor);
    
    // Trim all whitespace before, and at-and-after the cursor.
    //
    // It's okay if there is no whitespace here.
    //
    // By using trimEnd(), we're expanding the set of whitespace beyond what
    // Emacs will look for, but that Emacs function predates Unicode.  So this
    // is probably an improvement.  We could _just_ scan for the whitespace
    // instead of making a new string, but this is fast enough for an
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

  // TODO: Are selections always sorted?
  //
  // TODO: If not, can we sort them?

  // Perform all the edits at once by running all of the saved functions.
  editor.edit(
    edit => edits.forEach(args => {
      console.log("TRY");
      edit.replace(args.erasure, args.replacement);
      console.log("AFTER");
    })
  )
  .then(
    success => {
      // onFullfilled.
      if(!success)
      {
        // Assume it's because of overlapping regions.
        vscode.window.showWarningMessage("Edit failed");
      }
    },
    // onRejected.
    reason => {
      // Assume it's because of overlapping regions.
      //
      // TODO: Be smart enough to allow this.
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
  console.log("HELLO THERE");

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
