import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

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
  assert.strictEqual(selection.anchor.line, lineIndex);
  assert.strictEqual(selection.anchor.character, character);
  return true;
}

//------------------------------------------------------------------------------
// Single cursor test cases.

suite('single cursor', () => {

  test('pass 1', async () => {
    // TODO: Can we do this for the suite and then make each test case use the
    // existing document?
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

    // Line 1: Start, end no-ops and first space of multiple.
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
      // Repeat.
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
      // Repeat.
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
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 5)),
        line.text
      );
      assert.ok(checkCursor(editor, line, 5));

      // Running the command in the first after-space doesn't change the line,
      // but does move the cursor into the space.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 6)),
        line.text
      );
      assert.ok(checkCursor(editor, line, 5));
      // Repeat.
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

    // Line 2: second space of multiple.
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
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));
    }

    // Line 3: last space of multiple.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(2, 0));
      assert.strictEqual(line.text, orig[0]);
      const start = line.range.start;

      // Run it from the last space of many.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 28)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));

      // Running it again in the single space works.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));
    }

    // Line 4: one-past-the-last space of multiple.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(3, 0));
      assert.strictEqual(line.text, orig[0]);
      const start = line.range.start;

      // Run it from the one-past-the-last space of many.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 29)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));

      // Running it again in the single space works.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line, 17));
    }
  });
});
