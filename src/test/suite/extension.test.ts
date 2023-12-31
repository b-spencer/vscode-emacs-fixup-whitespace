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
  // GOTCHA: Reversed from normal API order to facilitate defaults.
  cursor: vscode.Position,
  anchor?: vscode.Position): Promise<string>
{
  // Move the cursor to the specified position, with either no selected region
  // or the specified selection anchor.
  const newSelections: vscode.Selection[] = [
    new vscode.Selection(anchor !== undefined ? anchor : cursor, cursor)
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
// `character`, with no region selected, or if `anchorCharacter` is specified, a
// selection on the same line from `anchorCharacter`.
function checkCursor(
  editor: vscode.TextEditor, 
  line: vscode.TextLine, 
  character: number,
  anchorCharacter?: number): boolean
{
  // There's exactly one selection.
  assert.strictEqual(editor.selections.length, 1);

  // Get the primary selection.
  const selection = editor.selections[0];

  // For brevity.
  const lineIndex = line.range.start.line;

  // Check 'em.
  assert.strictEqual(selection.active.line, lineIndex, "active line");
  assert.strictEqual(selection.active.character, character, "active char");
  assert.strictEqual(selection.anchor.line, lineIndex), "anchor line";
  assert.strictEqual(
    selection.anchor.character, 
    anchorCharacter !== undefined ? anchorCharacter : character, 
    "anchor char"
  );
  return true;
}

// Run the fixup-whitespace command at all cursor positions given.
async function runMultipleLines(
  editor: vscode.TextEditor,
  cursors: vscode.Position[]): Promise<string[]>
{
  // Set the new positions.
  const newSelections: vscode.Selection[] = [];
  cursors.forEach(
    cursor => newSelections.push(new vscode.Selection(cursor, cursor))
  );
  editor.selections = newSelections;

  // Run the command.
  return vscode.commands.executeCommand(
    "emacs-fixup-whitespace.fixupWhitespace"
  ).then(
    // onFulfilled.
    success => 
    {
      assert.strictEqual(success, true);
      
      // Get the resulting lines.
      const result: string[] = [];
      cursors.forEach(
        cursor => result.push(editor.document.lineAt(cursor.line).text)
      );
      return result;
    }
  );
}

//------------------------------------------------------------------------------
// Single cursor test cases.

suite('main', () => {

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

  // Return the line at `index`.
  //
  // It's important to re-fetch the line after ever modification for proper
  // testing.  The cursor positions move around during the edits.
  //
  function lineAtEditor(
    editor: vscode.TextEditor,
    index: number): vscode.TextLine
  {
    return editor.document.lineAt(new vscode.Position(index, 0));
  }

  // Test single cursor and the basic adjustments.
  test('single', async () => {
    // Mocha doesn't seem to support async functions inside suite() but does
    // support them here, so we clumsily lump all our test cases that use this
    // file together.
    const editor = await openTestFile("single.txt");

    // Bind lineAt() to the current editor.
    function lineAt(index: number): vscode.TextLine
    { return lineAtEditor(editor, index); }

    // Line 1: Start, end no-ops and first space of multiple.
    {
      // Get the line.
      const line = () => lineAt(0);
      assert.strictEqual(line().text, orig[0]);

      // Running the command at the line start has no effect.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        orig[0]
      );
      assert.ok(checkCursor(editor, line(), 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        orig[0]
      );
      assert.ok(checkCursor(editor, line(), 0));

      // Running the command at the end has no effect.
      assert.strictEqual(
        await runSingleLine(editor, line().range.end),
        orig[0]
      );
      assert.ok(checkCursor(editor, line(), line().range.end.character));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.end),
        orig[0]
      );
      assert.ok(checkCursor(editor, line(), line().range.end.character));

      // Running the command in the first space has no effect.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 5)),
        orig[0]
      );
      assert.ok(checkCursor(editor, line(), 5));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 5)),
        orig[0]
      );
      assert.ok(checkCursor(editor, line(), 5));

      // Running the command in the first after-space doesn't change the line,
      // but does move the cursor into the space.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 6)),
        orig[0]
      );
      assert.ok(checkCursor(editor, line(), 5));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 5)),
        orig[0]
      );
      assert.ok(checkCursor(editor, line(), 5));
      
      // Running it in the first space of the long part works.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));

      // Running it again in the same position makes no difference.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));
    }

    // Line 2: Second space of multiple.
    {
      // Get the line.
      const line = () => lineAt(1);
      assert.strictEqual(line().text, orig[0]);

      // Running it in the second space of the long part works, but moves the
      // cursor back.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 18)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));

      // Running it again in the single space works.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));
    }

    // Line 3: Last space of multiple.
    {
      // Get the line.
      const line = () => lineAt(2);
      assert.strictEqual(line().text, orig[0]);

      // Run it from the last space of many.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 28)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));

      // Running it again in the single space works.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));
    }

    // Line 4: One-past-the-last space of multiple.
    {
      // Get the line.
      const line = () => lineAt(3);
      assert.strictEqual(line().text, orig[0]);

      // Run it from the one-past-the-last space of many.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 29)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));

      // Running it again in the single space works.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 17)),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17));
    }

    // Line 5: Empty.
    {
      // Get the line.
      const line = () => lineAt(4);
      assert.strictEqual(line().text, "");

      // Run it from the only position on this line().
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        ""
      );
      assert.ok(checkCursor(editor, line(), 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        ""
      );
      assert.ok(checkCursor(editor, line(), 0));
    }

    // Line 6: Inserting a single space.
    {
      // Get the line.
      const line = () => lineAt(5);
      assert.strictEqual(line().text, orig[1]);

      // Run it from between the words.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 14)),
        fixed[1]
      );
      assert.ok(checkCursor(editor, line(), 14));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 14)),
        fixed[1]
      );
      assert.ok(checkCursor(editor, line(), 14));
    }

    // Line 7: A line with a single space on it.
    {
      // Get the line.
      const line = () => lineAt(6);
      assert.strictEqual(line().text, " ");

      // Run it from the line() start.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        ""
      );
      assert.ok(checkCursor(editor, line(), 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        ""
      );
      assert.ok(checkCursor(editor, line(), 0));
    }

    // Line 8: A line with a single space, run from the end.
    {
      // Get the line.
      const line = () => lineAt(7);
      assert.strictEqual(line().text, " ");

      // Run it from the line() start.
      assert.strictEqual(
        await runSingleLine(editor, line().range.end),
        ""
      );
      assert.ok(checkCursor(editor, line(), 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        ""
      );
      assert.ok(checkCursor(editor, line(), 0));
    }

    // Line 9: A line with spaces at the start from the start.
    {
      // Get the line.
      const line = () => lineAt(8);
      assert.strictEqual(line().text, orig[2]);

      // From the start position.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line(), 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line(), 0));
    }

    // Line 10: A line with spaces at the start from the middle.
    {
      // Get the line.
      const line = () => lineAt(9);
      assert.strictEqual(line().text, orig[2]);

      // From the a middle space position.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 1)),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line(), 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line(), 0));
    }

    // Line 11: A line with spaces at the start from the last space.
    {
      // Get the line.
      const line = () => lineAt(10);
      assert.strictEqual(line().text, orig[2]);

      // From the last space position.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 5)),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line(), 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line(), 0));
    }

    // Line 12: A line with spaces at the start from the past-the-last space.
    {
      // Get the line.
      const line = () => lineAt(11);
      assert.strictEqual(line().text, orig[2]);

      // From the past-last-space position.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 6)),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line(), 0));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start),
        fixed[2]
      );
      assert.ok(checkCursor(editor, line(), 0));
    }

    // Line 13: A line with spaces at the end from the end of the line.
    {
      // Get the line.
      const line = () => lineAt(12);
      assert.strictEqual(line().text, orig[3]);

      // From the end of the line().
      assert.strictEqual(
        await runSingleLine(editor, line().range.end),
        fixed[3]
      );
      assert.ok(checkCursor(editor, line(), 24));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 24)),
        fixed[3]
      );
      assert.ok(checkCursor(editor, line(), 24));
    }

    // Line 14: A line with spaces at the end from the last space on the line.
    {
      // Get the line.
      const line = () => lineAt(13);
      assert.strictEqual(line().text, orig[3]);

      // From the last space.
      assert.strictEqual(
        await runSingleLine(editor, line().range.end.translate(0, -1)),
        fixed[3]
      );
      assert.ok(checkCursor(editor, line(), 24));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 24)),
        fixed[3]
      );
      assert.ok(checkCursor(editor, line(), 24));
    }

    // Line 15: A line with spaces at the end from the middle of those spaces.
    {
      // Get the line.
      const line = () => lineAt(14);
      assert.strictEqual(line().text, orig[3]);

      // From the not-the-last space.
      assert.strictEqual(
        await runSingleLine(editor, line().range.end.translate(0, -3)),
        fixed[3]
      );
      assert.ok(checkCursor(editor, line(), 24));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 24)),
        fixed[3]
      );
      assert.ok(checkCursor(editor, line(), 24));
    }

    // Line 16: A line with spaces at the end from the first of those spaces.
    {
      // Get the line.
      const line = () => lineAt(15);
      assert.strictEqual(line().text, orig[3]);

      // From the first such space.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 24)),
        fixed[3]
      );
      assert.ok(checkCursor(editor, line(), 24));
      // Repeat.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 24)),
        fixed[3]
      );
      assert.ok(checkCursor(editor, line(), 24));
    }

    // Line 17: A line with spaces at the end from the last non-space.
    {
      // Get the line.
      const line = () => lineAt(16);
      assert.strictEqual(line().text, orig[3]);

      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 23)),
        // This inserts a space before the '.'.
        "This has space after it .       "
      );
      // And it puts the cursor in that space.
      assert.ok(checkCursor(editor, line(), 23));
      // Repeat from the new '.' location.
      assert.strictEqual(
        await runSingleLine(editor, line().range.start.translate(0, 24)),
        // It remains the same
        "This has space after it .       "
      );
      // And moves the cursor back to the space.
      assert.ok(checkCursor(editor, line(), 23));
    }

    // Finally, close the editor.
    
  });

  // Test selection adjustments (with a single cursor).
  //
  // All of the selection adjustments are actually done by the TextEditor.edit()
  // function, so we're just checking that we didn't mess it up.
  //
  test('single-selection', async () => {
    const editor = await openTestFile("single-selection.txt");

    // Bind lineAt() to the current editor.
    function lineAt(index: number): vscode.TextLine
    { return lineAtEditor(editor, index); }

    // Line 1: Selection from start into first space.
    {
      // Get the line.
      const line = () => lineAt(0);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          line().range.start.translate(0, 17),
          line().range.start
        ),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17, 0));
    }

    // Line 2: Selection from end into middle space.
    {
      // Get the line.
      const line = () => lineAt(1);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          line().range.start.translate(0, 18),
          line().range.end
        ),
        fixed[0]
      );
      assert.ok(checkCursor(editor, line(), 17, line().range.end.character));
    }

    // Line 3: Selection from on the last space to the first.
    {
      // Get the line.
      const line = () => lineAt(2);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          line().range.start.translate(0, 17),
          line().range.start.translate(0, 28)
        ),
        fixed[0]
      );
      // The selection mostly collapses since its region was replaced.
      assert.ok(checkCursor(editor, line(), 17, 18));
    }

    // Line 4: Selection from on almost last space to first.
    {
      // Get the line.
      const line = () => lineAt(3);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          line().range.start.translate(0, 17),
          line().range.start.translate(0, 27)
        ),
        fixed[0]
      );
      // The selection mostly collapses since its region was replaced.
      assert.ok(checkCursor(editor, line(), 17, 18));
    }

    // Line 5: Selection from one last the last space to first.
    {
      // Get the line.
      const line = () => lineAt(4);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          line().range.start.translate(0, 17),
          line().range.start.translate(0, 28)
        ),
        fixed[0]
      );
      // The selection mostly collapses since its region was replaced.
      assert.ok(checkCursor(editor, line(), 17, 18));
    }

    // Line 6: Selection from the first to almost the last space.
    {
      // Get the line.
      const line = () => lineAt(5);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          line().range.start.translate(0, 27),
          line().range.start.translate(0, 17)
        ),
        fixed[0]
      );
      // The selection collapses because we deleted all of its spaces.
      assert.ok(checkCursor(editor, line(), 17));
    }

    // Line 7: Selection from the first to on the last space.
    {
      // Get the line.
      const line = () => lineAt(6);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          line().range.start.translate(0, 28),
          line().range.start.translate(0, 17)
        ),
        fixed[0]
      );
      // The selection completely collapses.
      assert.ok(checkCursor(editor, line(), 17));
    }

    // Line 8: Selection from the first to after the last space.
    {
      // Get the line.
      const line = () => lineAt(7);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          line().range.start.translate(0, 29),
          line().range.start.translate(0, 17)
        ),
        fixed[0]
      );
      // Collapses.
      assert.ok(checkCursor(editor, line(), 17));
    }

    // Line 9: Selection entirely within the space and not on its edges.
    {
      // Get the line.
      const line = () => lineAt(8);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          line().range.start.translate(0, 26),
          line().range.start.translate(0, 19)
        ),
        fixed[0]
      );
      // Collapses.
      assert.ok(checkCursor(editor, line(), 17));
    }

    // Line 10: Reverse selection entirely within the space and not on its
    // edges.
    {
      // Get the line.
      const line = () => lineAt(9);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          line().range.start.translate(0, 19),
          line().range.start.translate(0, 26)
        ),
        fixed[0]
      );
      // Collapses.
      assert.ok(checkCursor(editor, line(), 17));
    }

    // Line 11: The selection anchor is after the spaces and its position is
    // adjusted.
    {
      // Get the line.
      const line = () => lineAt(10);
      assert.strictEqual(line().text, orig[0]);

      assert.strictEqual(
        await runSingleLine(
          editor, 
          // Includes the "spa" of "space".
          line().range.start.translate(0, 19),
          line().range.start.translate(0, 32)
        ),
        fixed[0]
      );
      // Still includes the "spa" of the now-moved "space".
      assert.ok(checkCursor(editor, line(), 17, 21));
    }
  });

  // Test multiple cursors.
  test('multiple', async () => {
    const editor = await openTestFile("multiple.txt");

    // Bind lineAt() to the current editor.
    function lineAt(index: number): vscode.TextLine
    { return lineAtEditor(editor, index); }

    // Line 1-3: Start, end no-ops and first space of multiple.
    {
      // Check the lines
      assert.strictEqual(lineAt(0).text, orig[0]);
      assert.strictEqual(lineAt(1).text, orig[0]);
      assert.strictEqual(lineAt(2).text, orig[0]);

      // Fix them all at once.
      assert.deepStrictEqual(
        await runMultipleLines(
          editor,
          [
            new vscode.Position(0, 19),
            new vscode.Position(1, 19),
            new vscode.Position(2, 19)
          ],
        ),
        [
          fixed[0],
          fixed[0],
          fixed[0]
        ]
      );
    }
  });
});
