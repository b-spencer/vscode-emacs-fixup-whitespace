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

// Check that there is one cursor position in `editor` and it is `line` at
// `character`, with no region selected.  Iff requested, this will `normalize`
// the position.
function checkCursor(
  editor: vscode.TextEditor, 
  line: vscode.TextLine, 
  character: number,
  normalize?: boolean): boolean
{
  // There's exactly one selection.
  assert.strictEqual(editor.selections.length, 1);

  // Get the primary selection.
  let selection = editor.selections[0];

  // If told to, normalize the position, since sometimes VS Code's edit
  // operation will leave the position off the end of the line.
  if(normalize)
  {
    selection = new vscode.Selection(
      editor.document.validatePosition(selection.anchor),
      editor.document.validatePosition(selection.active)
    );
  }

  // For brevity.
  const lineIndex = line.range.start.line;

  // Check 'em.
  assert.strictEqual(selection.active.line, lineIndex, "active line");
  assert.strictEqual(selection.active.character, character, "active char");
  assert.strictEqual(selection.anchor.line, lineIndex), "anchor line";
  assert.strictEqual(selection.anchor.character, character, "anchor char");
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
      // Lines 1 through 4.
      "There is too much            space here.",
      // Line 6.
      "There is spacemissing here.",
      // Lines 9 through 12.
      "      This has space before it.",
      // Lines 13 through 15.
      "This has space after it.       ",
    ];

    // The fixed lines.
    const fixed = [
      // Lines 1 through 4.
      "There is too much space here.",
      // Line 6.
      "There is space missing here.",
      // Lines 9 through 12.
      "This has space before it.",
      // Lines 13 through 15.
      "This has space after it.",
    ];

    // Line 1: Start, end no-ops and first space of multiple.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(0, 0));
      assert.strictEqual(line.text, orig[0]);
      const start = line.range.start;
      const lineIndex = line.range.start.line;

      // Running the command at the start has no effect.
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

    // Line 2: Second space of multiple.
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

    // Line 3: Last space of multiple.
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

    // Line 4: One-past-the-last space of multiple.
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

    // Line 5: Empty.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(4, 0));
      assert.strictEqual(line.text, "");
      const start = line.range.start;

      // Run it from the only position on this line.
      assert.strictEqual(
        await runSingleLine(editor, start),
        ""
      );
      assert.ok(checkCursor(editor, line, 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start),
        ""
      );
      assert.ok(checkCursor(editor, line, 0));
    }

    // Line 6: Inserting a single space.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(5, 0));
      assert.strictEqual(line.text, orig[1]);
      const start = line.range.start;

      // Run it from between the words.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 14)),
        fixed[1]
      );
      assert.ok(checkCursor(editor, line, 14));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 14)),
        fixed[1]
      );
      assert.ok(checkCursor(editor, line, 14));
    }

    // Line 7: A line with a single space on it.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(6, 0));
      assert.strictEqual(line.text, " ");
      const start = line.range.start;

      // Run it from the line start.
      assert.strictEqual(
        await runSingleLine(editor, start),
        ""
      );
      assert.ok(checkCursor(editor, line, 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start),
        ""
      );
      assert.ok(checkCursor(editor, line, 0));
    }

    // Line 8: A line with a single space, run from the end.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(7, 0));
      assert.strictEqual(line.text, " ");
      const start = line.range.start;

      // Run it from the line start.
      assert.strictEqual(
        await runSingleLine(editor, line.range.end),
        ""
      );
      assert.ok(checkCursor(editor, line, 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start),
        ""
      );
      assert.ok(checkCursor(editor, line, 0));
    }

    // Line 9: A line with spaces at the start from the start.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(8, 0));
      assert.strictEqual(line.text, orig[2]);
      const start = line.range.start;

      // From the start position.
      assert.strictEqual(
        await runSingleLine(editor, start),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line, 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line, 0));
    }

    // Line 10: A line with spaces at the start from the middle.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(9, 0));
      assert.strictEqual(line.text, orig[2]);
      const start = line.range.start;

      // From the a middle space position.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 1)),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line, 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line, 0));
    }

    // Line 11: A line with spaces at the start from the last space.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(10, 0));
      assert.strictEqual(line.text, orig[2]);
      const start = line.range.start;

      // From the last space position.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 5)),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line, 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line, 0));
    }

    // Line 12: A line with spaces at the start from the past-the-last space.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(11, 0));
      assert.strictEqual(line.text, orig[2]);
      const start = line.range.start;

      // From the past-last-space position.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 6)),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line, 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line, 0));
    }

    // Line 13: A line with spaces at the end from the end of the line.
    {
      // Get the line.
      const line = editor.document.lineAt(new vscode.Position(12, 0));
      assert.strictEqual(line.text, orig[3]);
      const start = line.range.end;

      // From the end of the line.
      assert.strictEqual(
        await runSingleLine(editor, line.range.end),
        fixed[3]
      );
      assert.ok(checkCursor(editor, line, 24));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, start.translate(0, 24)),
        fixed[3]
      );
      // We need to normalize the line position VS Code itself computes in this
      // case.  It's not clear why it gets it wrong.
      assert.ok(checkCursor(editor, line, 24, true));
    }
  });
});
