import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";
import * as fs from "fs";
import { isFalkonFile } from "./utils";

export function escapeShellArg(arg: string, isWindows: boolean): string {
  if (isWindows) {
    // PowerShell single-quoted string: escape ' by doubling it
    return `'${arg.replace(/'/g, "''")}'`;
  } else {
    // Bash/Sh single-quoted string: escape ' by replacing with '\''
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
}

export function checkFalkonInstallation(
  bar: vscode.StatusBarItem,
  showNotification: boolean
): Promise<boolean> {
  return new Promise((resolve) => {
    cp.exec("falkon -v", { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        bar.text = `$(alert) Falkon: CLI Missing`;
        bar.tooltip = `Falkon compiler not found in PATH. Click to verify.`;
        bar.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        if (showNotification) {
          vscode.window.showErrorMessage(
            "Falkon CLI not found in PATH. Please install it and add it to your system PATH."
          );
        }
        resolve(false);
      } else {
        const version = stdout.trim() || stderr.trim() || "unknown version";
        bar.text = `$(check) Falkon: Ready`;
        bar.tooltip = `Falkon compiler is ready.\nVersion: ${version}`;
        bar.backgroundColor = undefined;
        if (showNotification) {
          vscode.window.showInformationMessage(`Falkon CLI is ready! (${version})`);
        }
        resolve(true);
      }
    });
  });
}

export async function buildAndRun(document: vscode.TextDocument): Promise<void> {
  const filePath = document.uri.fsPath;
  if (!isFalkonFile(filePath)) {
    return;
  }

  // Save the document first so the latest changes are compiled
  if (document.isDirty) {
    await document.save();
  }

  const folder = path.dirname(filePath);
  if (!fs.existsSync(folder)) {
    vscode.window.showErrorMessage(`Directory does not exist: ${folder}`);
    return;
  }

  const fileName = path.parse(filePath).name;
  const isWindows = process.platform === "win32";
  const exeName = isWindows ? `${fileName}.exe` : fileName;

  // Always dispose and recreate terminal so cwd is always correct
  const existingTerminal = vscode.window.terminals.find(
    (t: vscode.Terminal) => t.name === "Falkon Run"
  );
  if (existingTerminal) {
    existingTerminal.dispose();
  }
  let terminal: vscode.Terminal;
  try {
    terminal = vscode.window.createTerminal({
      name: "Falkon Run",
      cwd: folder,
      shellPath: isWindows ? "powershell.exe" : undefined,
    });
  } catch (error) {
    console.warn("Falkon: Failed to create terminal with powershell.exe, falling back to default shell.", error);
    terminal = vscode.window.createTerminal({
      name: "Falkon Run",
      cwd: folder,
    });
  }

  terminal.show(true);

  // Safely escape arguments to prevent shell command injection
  const escapedBaseName = escapeShellArg(path.basename(filePath), isWindows);
  const escapedExePath = escapeShellArg(isWindows ? `.\\${exeName}` : `./${exeName}`, isWindows);

  const buildCmd = `falkon build ${escapedBaseName}`;
  const runCmd = isWindows ? `& ${escapedExePath}` : `${escapedExePath}`;
  const fullCmd = isWindows
    ? `${buildCmd} ; if ($LASTEXITCODE -eq 0) { ${runCmd} }`
    : `${buildCmd} && ${runCmd}`;

  // Show status bar feedback for compilation/running
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = `$(sync~spin) Falkon: Building & Running "${path.basename(filePath)}"...`;
  statusBarItem.tooltip = "Click to focus build terminal";
  statusBarItem.command = "workbench.action.terminal.focus";
  statusBarItem.show();
  setTimeout(() => {
    statusBarItem.dispose();
  }, 4000);

  terminal.sendText(fullCmd);
}
