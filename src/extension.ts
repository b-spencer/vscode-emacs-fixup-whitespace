// Copyright 2023 Brad Spencer
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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

  // We build a list of edits, one per selection (i.e. one per cursor).
  let edits: {
    // The range we need to erase.
    erasure: vscode.Range; 

    // The replacement (either empty or a single space).
    replacement: string;

    // How long was the prefix part that we're erasing?  We need this to fix the
    // cursor position in a quirky edge case.
    prefixTrimSize: number;
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

    // Save information about how to perform this edit and where the cursor was.
    edits.push({erasure, replacement, prefixTrimSize});
  }

  // Perform all the edits at once.
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
      // The cursor was in the erasure range.  Sometimes, TextEditor will move
      // the cursor for us, such as when our replace operation removes the
      // character that the cursor was on (without replacing it with a new one).
      // When it does, it will put the cursor at the end of the replacement.
      //
      // Other times, it will leave the cursor alone, or it will end up putting
      // the cursor where we want it.
      //
      // And, if two cursors end up in the same place, TextEditor removes the
      // second one (as ordered by our iteration through the selections, it
      // seems).
      //
      // We must consider each of the replacements that we made, which should
      // represent each of the remaining cursors.  
      //
      // So, do we properly know how many selections (cursors) there are?
      //
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

      // Yes.  To move any cursor, we must set the entire selections array at
      // once.  We need to make a brand new new array because
      // `editor.selections` is readonly.  And the simplest way to populate that
      // new array  is to just make new Selection objects.  So we do that.
      let newSelections: vscode.Selection[] = [];
      for(let i = 0; i < editor.selections.length; ++i)
      {
        newSelections.push(
          new vscode.Selection(
            // Leave the anchor unchanged.  This means that the selections that
            // the user had (to extant cursors) remain intact.
            editor.selections[i].anchor,

            // Adjust the active cursor position as needed.
            editor.selections[i].active.translate(
              // We never move the cursor to a different line.
              0,

              // We move the cursor to the left iff we erased anything other
              // than 1 space (when the cursor wasn't sitting on the first
              // erased space [a quirk, since it's still there now]) . . .
              (
                (
                  (edits[i].erasure.end.character 
                  - edits[i].erasure.start.character) !== 1
                  && edits[i].prefixTrimSize !== 0
                )
              // . . . or we erased exactly 1 character and it was all in the
              // prefix (a quirky special case) . . .
                || edits[i].prefixTrimSize === 1
              )
              // . . . and we actually inserted anything.  (This second
              // conditional happens via our replacement.length being zero.)
              //
              // Such a condition means that TextEditor moved the cursor to the
              // end of a non-empty replacement, and we must move it back.
              //
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
      // We must have assembled an invalid package of edit operations.  This
      // shouldn't happen.  If it does, we have a bug.
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
