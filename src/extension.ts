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

  // We'll be building a list of replacement selections.
  let newSelections = [];

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

    // Split the line at the cursor and trim all whitespace before, and
    // at-and-after the cursor.
    //
    // It's okay if there is no whitespace here.
    //
    // By using trimEnd(), we're expanding the set of whitespace beyond what
    // Emacs will look for, but that Emacs function predates Unicode.  So this
    // is probably an improvement.  Plus, it's likely not slow.
    //
    const prefix = line.substring(0, cursor).trimEnd();
    const suffix = line.substring(cursor).trimStart();

    // Now, put that back together with a single space character, unless the
    // cursor is at the start or end of the line, or we removed the entire
    // prefix.  (Note that we've deleted any whitespace that was sitting under
    // the cursor.)
    const middle = 
      (cursor === 0 || prefix.length === 0 || cursor === lineRange.end.character)
      ? ""
      : " "; 

    // Huzzah.
    const replacement = prefix + middle + suffix;
    console.log(`Built repl: ${replacement}`);

    // Move the cursor to be at the end of the (new) prefix.
    const newCursorPosition = lineRange.start.translate(0, prefix.length);
    console.log(`Update pos: ` + " ".repeat(prefix.length) + "█");

    // Now that the cursor is in the right place, replace the line.
    editor.edit(edit => edit.replace(lineRange, replacement));

    // Remember that new cursor in a replacement selections array.
    newSelections.push(
      new vscode.Selection(
        // This eliminates any selection region by putting the anchor and active
        // positions in the same place.
        newCursorPosition,
        newCursorPosition
      )
    );
  }

  // And set the new cursor positions.
  editor.selections = newSelections;
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
