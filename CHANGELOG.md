# Change Log

All notable changes to the "emacs-fixup-whitespace" extension will be documented in this file.

## [1.0.3]

 - I had time to learn how to write automated tests for a VS Code extension, so
   now there are automated tests.
  
 - Found and fixed several cursor placement bugs via automated testing.

## [1.0.2]

- Fixed the cursor position when running `fixup-whitespace` from the first space
  character in a erased region (regression introduced in 1.0.1).

## [1.0.1]

- Fixed cursor position after running `fixup-whitespace` from the first
  non-space character after a single space character.
  
## [1.0.0]

- Initial release
