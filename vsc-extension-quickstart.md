# Welcome to Cimple Language Support

## What is in this folder

* package.json declares the Cimple language mode and where the grammar and configuration live.
* syntaxes/cimple.tmLanguage.json aliases source.cimple to the built-in VS Code Python grammar so you get instant highlighting.
* language-configuration.json controls the brackets, comments, and on-enter indent behavior so the editor behaves like Python today.
* extension.js provides the Cimple run command bound to F5 for Cimple files.

## Quick start

1. Run npm install.
2. Press F5 to open the Extension Development Host.
3. Open a .cimp, .csc, or .cimple file to confirm Python highlighting.
4. Press F5 to run the Cimple build command and then execute the generated program.

## Making changes

* Reload the Extension Development Host (Ctrl+R or Cmd+R) to pick up grammar/configuration tweaks.

## Next steps

* Add new tokens to syntaxes/cimple.tmLanguage.json if Cimple diverges from Python in the future.
* Publish by following the instructions at https://code.visualstudio.com/api/working-with-extensions/publishing-extension once you are satisfied with the release notes in CHANGELOG.md.
