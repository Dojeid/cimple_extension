# Welcome to Cimple Language Support

## What is in this folder

* package.json declares the Cimple language mode, activation events, and where the grammar and configuration live.
* syntaxes/cimple.tmLanguage.json aliases source.cimple to the built-in VS Code Python grammar so you get instant highlighting.
* language-configuration.json controls the brackets, comments, and on-enter indent behavior so the editor behaves like Python today.
* src/extension.ts contains a minimal VS Code extension entry point in case we add code later.

## Quick start

1. Run npm install to pull in the TypeScript toolchain.
2. Compile with npm run compile (this writes out/extension.js).
3. Press F5 to open the Extension Development Host.
4. Open a .cimp, .csc, or .cimple file to confirm Python highlighting and bracket behavior.

## Making changes

* After editing files, rerun npm run compile or leave npm run watch running during development.
* Reload the Extension Development Host (Ctrl+R or Cmd+R) to pick up grammar/configuration tweaks.

## Next steps

* Add new tokens to syntaxes/cimple.tmLanguage.json if Cimple diverges from Python in the future.
* Publish by following the instructions at https://code.visualstudio.com/api/working-with-extensions/publishing-extension once you are satisfied with the release notes in CHANGELOG.md.
