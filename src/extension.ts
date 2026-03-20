import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";
import * as fs from "fs";

const CIMPLE_EXTENSIONS = new Set([".cimp"]);

function isCimpleFile(fsPath: string): boolean {
  return CIMPLE_EXTENSIONS.has(path.extname(fsPath).toLowerCase());
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

class CimpleDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  /**
   * Provide initial debug configurations.
   */
  provideDebugConfigurations(
    folder: vscode.WorkspaceFolder | undefined,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [
      {
        type: 'cimple',
        name: 'Launch',
        request: 'launch'
      }
    ];
  }

  /**
   * Massage a debug configuration before it is used to launch a debug session.
   */
  async resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    token?: vscode.CancellationToken
  ): Promise<vscode.DebugConfiguration | undefined> {
    console.log("Cimple Debug: resolveDebugConfiguration called", config);
    
    // If no config is provided (e.g. F5 without launch.json), we provide a default one
    if (!config.type && !config.request && !config.name) {
      console.log("Cimple Debug: Config is empty, providing defaults");
      config.type = 'cimple';
      config.name = 'Launch';
      config.request = 'launch';
    }

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      console.log("Cimple Debug: Active editor path:", editor.document.uri.fsPath);
      if (isCimpleFile(editor.document.uri.fsPath)) {
        console.log("Cimple Debug: Is a Cimple file, calling buildAndRun");
        await buildAndRun(editor.document);
      } else {
        console.log("Cimple Debug: NOT a Cimple file");
        vscode.window.showErrorMessage("Active file is not a .cimp file.");
      }
    } else {
      console.log("Cimple Debug: No active editor");
      vscode.window.showErrorMessage("No active Cimple file to run.");
    }

    return undefined; // Abort the actual debug session launch as we handle it via terminal
  }
}

export function activate(context: vscode.ExtensionContext): void {
  console.log("Cimple extension is now active!");

  // Register the debug configuration provider
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider('cimple', new CimpleDebugConfigurationProvider())
  );

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

export function deactivate(): void {}
