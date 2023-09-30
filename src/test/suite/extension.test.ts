import * as assert from 'assert';
import { setMaxIdleHTTPParsers } from 'http';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

// Where are our test documents?
const testFilesDir = path.join(
  __dirname, '..', '..', '..', 'src', 'test', 'files'
);

// Open a test document.
async function openTestFile(name: string): Promise<vscode.TextEditor>
{
  // Get the full path to our test document.
  const filename = path.join(testFilesDir, name);
  // console.log(`Opening ${filename}`);
  const uri = vscode.Uri.file(filename);

  // Open it in a new editor.
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);

  // Log what we opened.
  // console.log(
  //   "Opened document with contents:\n" 
  //   + editor.document.getText()
  // );

  return editor;
}

// Run the fixup-whitespace command at a single cursor position and return the
// resulting line.  No selection active.
async function runSingleLine(
  editor: vscode.TextEditor, 
  cursor: vscode.Position): Promise<string>
{
  // Move the cursor to the specified position, with no selected region.
  const newSelections: vscode.Selection[] = [
    new vscode.Selection(cursor, cursor)
  ];
  editor.selections = newSelections;

  // Remember the line we're on as a position.  We use this because it's
  // immutable over the operation.
  const lineStart = new vscode.Position(cursor.line, 0);

  // Run the command.
  return vscode.commands.executeCommand(
    "emacs-fixup-whitespace.fixupWhitespace"
  ).then(
    // onFulfilled.
    success => 
    {
      assert.strictEqual(success, true);
      
      // Get the resulting line.
      return editor.document.lineAt(lineStart).text;
    }
  );
}

//------------------------------------------------------------------------------
// Simple test cases.

suite('simple', () => {

  test('begin none', async () => {
    const editor = await openTestFile("simple.txt");
    
    // Get the first line as-is.
    const line = editor.document.lineAt(new vscode.Position(0, 0));
    assert.strictEqual(line.text, "There is too much            space here.");
    const start = line.range.start;

    // Running the command at the start has no effecct.
    assert.strictEqual(
      await runSingleLine(editor, start),
      line.text
    );

    // Running the command at the end has no effect.
    assert.strictEqual(
      await runSingleLine(editor, line.range.end),
      line.text
    );

    // Running the command in the first space has no effect.
    assert.strictEqual(
      await runSingleLine(editor, start.translate(0, 5)),
      line.text
    );
    
    // Running it in the first space of the long part works.
    const fixed = "There is too much space here.";
    assert.strictEqual(
      await runSingleLine(editor, start.translate(0, 18)),
      fixed
    );

  });
});

// suite('Extension Test Suite', () => {
// 	vscode.window.showInformationMessage('Start all tests.');

// 	test('Sample test', () => {
// 		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
// 		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
// 	});
// });
