# Cimple Language Support

VS Code extension for the **Cimple** programming language.

## Features

- **Syntax Highlighting**: Python-compatible grammar tailored for Cimple.
- **File Icons**: Custom icon support for `.cimp` files.
- **Build & Run**: Build and execute Cimple source files directly from the editor.
- **Windows Integration**: Optional registration for Cimple file icons in Windows File Explorer.

## Getting Started

1. Open any `.cimp` file.
2. Press **`Ctrl+F5`** to build and run the current file.
3. The build process uses the `cimple` CLI and displays output in a dedicated "Cimple Run" terminal (PowerShell on Windows).

## Technical Details

- **Grammar**: Reuses the built-in VS Code Python grammar via aliasing (`source.python` -> `source.cimple`).
- **Icons**: Provides a high-resolution Cimple logo for all `.cimp` files.
- **Terminal Integration**: Successive runs reuse the same terminal instance to preserve command history.

## Commands

- `Cimple: Build and Run Active File` (**`Ctrl+F5`**)
- `Cimple: Register Windows File Explorer Icons` (Windows only)

## Troubleshooting

### Icons not appearing or appearing on all files?
If you previously used an older version of the Cimple extension, your Icon Theme might still be set to a legacy theme.
1. Open the Command Palette (`Ctrl+Shift+P`).
2. Select **File Icon Theme**.
3. Choose **Seti (default)** or any other preferred theme.
The Cimple extension will automatically provide its icon to any theme that supports language icons.

### F5 doesn't work?
To avoid conflict with VS Code's built-in debugger, the build command is mapped to **`Ctrl+F5`** (Run Without Debugging). 
