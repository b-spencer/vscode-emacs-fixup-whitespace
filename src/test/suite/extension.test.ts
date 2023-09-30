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

// Check that there is one cursor position and it is `line` at `character`, with
// no region selected.
function checkCursor(
  editor: vscode.TextEditor, 
  line: vscode.TextLine, 
  character: number): boolean
{
  const lineIndex = line.range.start.line;
  assert.strictEqual(editor.selections.length, 1);
  const selection = editor.selections[0];
  assert.strictEqual(selection.active.line, lineIndex);
  assert.strictEqual(selection.active.character, character);
  return true;
}

//------------------------------------------------------------------------------
// Simple test cases.

suite('simple', () => {

  test('pass 1', async () => {
    const editor = await openTestFile("simple.txt");

    // The original lines.
    const orig = [
      // 1 through 4.
      "There is too much            space here."
    ];

    // The fixed lines.
    const fixed = [
      // 1 through 4.
      "There is too much space here."
    ];

    // line 1
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(0, 0));
      assert.strictEqual(line.text, orig[0]);
      const start = line.range.start;
      const lineIndex = line.range.start.line;

      // Running the command at the start has no effecct.
      assert.strictEqual(
        await runSingleLine(editor, start),
        line.text
      );
      assert.ok(checkCursor(editor, line, 0));

      // Running the command at the end has no effect.
      assert.strictEqual(
        await runSingleLine(editor, line.range.end),
        line.text
      );
      assert.ok(checkCursor(editor, line, line.range.end.character));

      // Running the command in the first space has no effect.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 5)),
        line.text
      );
      assert.ok(checkCursor(editor, line, 5));
      
      // Running it in the first space of the long part works.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));

      // Running it again in the same position makes no difference.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));
    }

    // line 2
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(1, 0));
      assert.strictEqual(line.text, orig[0]);
      const start = line.range.start;

      // Running it in the second space of the long part works, but moves the
      // cursor back.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 18)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));

      // Running it again in the single space works.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));
    }
  });
});
