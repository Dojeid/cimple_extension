import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";
import * as fs from "fs";

const CIMPLE_EXTENSIONS = new Set([".cimp"]);

function isCimpleFile(fsPath: string): boolean {
  return CIMPLE_EXTENSIONS.has(path.extname(fsPath).toLowerCase());
}

async function registerIcons(context: vscode.ExtensionContext): Promise<void> {
  if (process.platform !== "win32") {
    vscode.window.showInformationMessage("Icon registration is only available on Windows.");
    return;
  }

  const scriptPath = vscode.Uri.joinPath(context.extensionUri, "resources", "scripts", "register.bat").fsPath;
  if (!fs.existsSync(scriptPath)) {
    vscode.window.showErrorMessage("Registration script not found.");
    return;
  }

  // Run the batch file which handles the permission and registry call
  cp.exec(`start "" "${scriptPath}"`, (error: Error | null) => {
    if (error) {
      vscode.window.showErrorMessage(`Failed to launch registration: ${error.message}`);
    }
  });
}

async function checkAndRegisterWindowsIcons(context: vscode.ExtensionContext): Promise<void> {
  // Only run this on Windows and only once per installation
  if (process.platform !== "win32") return;
  
  const hasAsked = context.globalState.get("hasAskedForIcons", false);
  if (hasAsked) return;

  const selection = await vscode.window.showInformationMessage(
    "Would you like to register Cimple icons for Windows File Explorer?",
    "Yes", "Not now"
  );

  if (selection === "Yes") {
    await registerIcons(context);
  }
  
  // Save that we've asked so we don't bother the user again
  await context.globalState.update("hasAskedForIcons", true);
}

async function buildAndRun(document: vscode.TextDocument): Promise<void> {
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
  
  // Find existing Cimple terminal or create a new one
  let terminal = vscode.window.terminals.find((t: vscode.Terminal) => t.name === "Cimple Run");
  if (!terminal) {
    terminal = vscode.window.createTerminal({
      name: "Cimple Run",
      cwd: folder,
      // Ensure we use PowerShell on Windows if specifically requested or available
      shellPath: isWindows ? "powershell.exe" : undefined
    });
  }

  terminal.show(true); // Show terminal but preserve focus in the editor

  // Build the command: cimple build <file> ; .\<exe>
  // PowerShell uses ; for command chaining. Newer PS also supports &&.
  const buildCmd = `cimple build "${path.basename(filePath)}"`;
  const runCmd = isWindows ? `.\\"${exeName}"` : `./"${exeName}"`;
  
  // On Windows PowerShell, we use ; to chain commands reliably across versions.
  const fullCmd = isWindows 
    ? `${buildCmd} ; ${runCmd}` 
    : `${buildCmd} && ${runCmd}`;

  terminal.sendText(fullCmd);
}

export function activate(context: vscode.ExtensionContext): void {
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

  const registerIconsCommand = vscode.commands.registerCommand("cimple.registerIcons", async () => {
    await registerIcons(context);
  });

  context.subscriptions.push(runCommand, registerIconsCommand);
}

export function deactivate(): void {}
