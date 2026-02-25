# Cimple Syntax Highlighting

Cimple is a Python-compatible language with a few small twists, so this extension reuses VS Code built-in Python TextMate grammar and maps it to the cimple scope. That keeps the colors, comments, and indentation assistance you already expect while laying the groundwork for future Cimple-specific tweaks.

## Features

- Adds the Cimple language mode with .cimp, .csc, and .cimple filenames.
- Reuses the stock Python grammar source.python by aliasing it through source.cimple.
- Ships a language configuration for comments, brackets, and indentation so VS Code behaves like Python by default.
- Press F5 on an active Cimple file to run cimple build <file>.
- If the build succeeds, the generated .exe runs in a VS Code terminal.

## Quick start

1. Run npm install.
2. Press F5 to open the Extension Development Host.
3. Open a .cimp, .csc, or .cimple file and press F5 to build and run.

## Extending the grammar

syntaxes/cimple.tmLanguage.json merely includes source.python today. If you need to colorize new Cimple keywords, operators, or literal formats later, add new patterns to the repository section and reference them from the patterns array. That way you can build on the Python base without rewriting the entire grammar.

## Testing the setup

* Launch the dev host and verify syntax colors and bracket behavior.
* Reload the Extension Development Host window after grammar/config updates.

## Publishing notes

Since this extension is purely language metadata and grammar files, the contributes block is the public API: any file that matches .cimp, .csc, or .cimple maps to source.cimple. No activation events beyond onLanguage:cimple are needed right now.
