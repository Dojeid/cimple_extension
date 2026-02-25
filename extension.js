"use strict";

const vscode = require("vscode");
const cp = require("child_process");
const path = require("path");

const CIMPLE_EXTENSIONS = new Set([".cimp", ".csc", ".cimple"]);

function isCimpleFile(fsPath) {
  return CIMPLE_EXTENSIONS.has(path.extname(fsPath).toLowerCase());
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(command, args, {
      cwd,
      shell: true,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

let runTerminal;
let isBuilding = false;

function getRunTerminal(cwd) {
  if (!runTerminal || runTerminal.exitStatus) {
    runTerminal = vscode.window.createTerminal({
      name: "Cimple Run",
      cwd,
      shellPath: "C:\\Windows\\System32\\cmd.exe"
    });
  }
  return runTerminal;
}

async function buildAndRun(document) {
  const filePath = document.uri.fsPath;
  if (!isCimpleFile(filePath) || isBuilding) {
    return;
  }

  isBuilding = true;
  const folder = path.dirname(filePath);
  const exePath = path.join(folder, path.parse(filePath).name + ".exe");

  try {
    const buildResult = await runProcess("cimple", ["build", filePath], folder);
    if (buildResult.code !== 0) {
      const details = [buildResult.stderr, buildResult.stdout].filter(Boolean).join("\n").trim();
      const message = details ? `Cimple build failed:\n${details}` : `Cimple build failed (exit code ${buildResult.code}).`;
      vscode.window.showErrorMessage(message);
      return;
    }

    const terminal = getRunTerminal(folder);
    terminal.show(true);
    terminal.sendText(`"${exePath}"`, true);
  } catch (err) {
    vscode.window.showErrorMessage(`Cimple build error: ${err.message}`);
  } finally {
    isBuilding = false;
  }
}

function activate(context) {
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
