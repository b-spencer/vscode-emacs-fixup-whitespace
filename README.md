# emacs-fixup-whitespace

This emulates the behaviour of the `fixup-whitespace` Emacs command.  

## Features

The `emacs-fixup-whitespace.fixupWhitespace` command deletes
all whitespace at, before, and after the cursor.  Then, if it finds the cursor
not at the start or end of the line, it adds a single space.

This is very useful when joining lines, for example.  Jump to the end of the
line, delete the newline, and then run this command.  All of the trailing
whitespace from the first line and leading whitespace from the second line will
be squashed into a single space.

## Extension Settings

You must manually add a key binding for the new command.  For example:

```json
    {
      "key": "ctrl+f9",
      "command": "emacs-fixup-whitespace.fixupWhitespace",
      "when": "editorFocus && !editorReadonly"
    }
```

## Known Issues

When there are multiple cursors, this only operates on the first one.

## Release Notes

### 0.0.3

Initial release.

