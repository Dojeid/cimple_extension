"use strict";

const vscode = require("vscode");
const path = require("path");

const cp = require("child_process");

const CIMPLE_EXTENSIONS = new Set([".cimp"]);

function isCimpleFile(fsPath) {
  return CIMPLE_EXTENSIONS.has(path.extname(fsPath).toLowerCase());
}

async function checkAndRegisterWindowsIcons(context) {
  // Only run this on Windows and only once per installation
  if (process.platform !== "win32") return;
  
  const hasAsked = context.globalState.get("hasAskedForIcons", false);
  if (hasAsked) return;

  const selection = await vscode.window.showInformationMessage(
    "Would you like to register Cimple icons for Windows File Explorer?",
    "Yes", "Not now"
  );

  if (selection === "Yes") {
    const scriptPath = path.join(context.extensionPath, "register.bat");
    // Run the batch file which handles the permission and registry call
    cp.exec(`start "" "${scriptPath}"`, (error) => {
      if (error) {
        vscode.window.showErrorMessage(`Failed to launch registration: ${error.message}`);
      }
    });
  }
  
  // Save that we've asked so we don't bother the user again
  await context.globalState.update("hasAskedForIcons", true);
}

async function buildAndRun(document) {
  const filePath = document.uri.fsPath;
  if (!isCimpleFile(filePath)) {
    return;
  }

  // Save the document first to ensure the latest changes are built
  if (document.isDirty) {
    await document.save();
  }

  const folder = path.dirname(filePath);
  const fileName = path.parse(filePath).name;
  
  const isWindows = process.platform === "win32";
  const exeName = isWindows ? `${fileName}.exe` : fileName;
  const runPrefix = isWindows ? ".\\" : "./";

  // Find and dispose existing Cimple terminal to stop any running process
  const existingTerminal = vscode.window.terminals.find(t => t.name === "Cimple Run");
  if (existingTerminal) {
    existingTerminal.dispose();
  }

  // Create a new terminal for a clean run
  const terminal = vscode.window.createTerminal({
    name: "Cimple Run",
    cwd: folder
  });

  terminal.show(true); // Show terminal but preserve focus in the editor

  // Build the command: cimple build <file> && <exe>
  const buildCmd = `cimple build "${path.basename(filePath)}"`;
  const runCmd = `${runPrefix}"${exeName}"`;
  
  // Cross-platform command execution logic
  // On Windows, use cmd /c to ensure && works regardless of the user's default shell (like old PowerShell)
  const fullCmd = isWindows 
    ? `cmd /c "${buildCmd} && ${runCmd}"` 
    : `${buildCmd} && ${runCmd}`;

  terminal.sendText(fullCmd);
}

function activate(context) {
  // Check if we should ask to register Windows icons
  checkAndRegisterWindowsIcons(context);

  const runCommand = vscode.commands.registerCommand("cimple.buildAndRun", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor found.");
      return;
    }

    if (!isCimpleFile(editor.document.uri.fsPath)) {
      vscode.window.showWarningMessage("Active file is not a Cimple source file.");
      return;
    }

    await buildAndRun(editor.document);
  });

  context.subscriptions.push(runCommand);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
