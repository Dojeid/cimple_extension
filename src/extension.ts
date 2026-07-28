import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { isFalkonFile } from "./utils";
import { checkFalkonInstallation, buildAndRun } from "./compiler";
import { FalkonDebugConfigurationProvider } from "./debug";
import {
  showWelcomeWebview,
  setupWelcomeWebview,
  setWelcomeStatusBarItem,
  clearWelcomePanel,
  welcomePanel
} from "./welcome";

let hasShownInSession = false;
let statusBarItem: vscode.StatusBarItem | undefined;

function checkCompletionStatus(context: vscode.ExtensionContext) {
  const hasVerifiedCli = context.globalState.get<boolean>("falkon.hasVerifiedCli", false);
  const hasOpenedSettings = context.globalState.get<boolean>("falkon.hasOpenedSettings", false);
  if (hasVerifiedCli && hasOpenedSettings) {
    context.globalState.update("falkon.walkthroughCompleted", true);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  console.log("Falkon extension activating...");

  const markerPath = path.join(context.extensionPath, ".installed_marker");
  let isFreshInstall = false;
  try {
    if (!fs.existsSync(markerPath)) {
      isFreshInstall = true;
      fs.writeFileSync(markerPath, "installed", "utf8");
    }
  } catch (err) {
    console.error("Falkon: Failed to check/write install marker", err);
  }

  if (isFreshInstall) {
    console.log("Falkon: Fresh installation detected. Resetting onboarding state...");
    context.globalState.update("falkon.hasVerifiedCli", undefined);
    context.globalState.update("falkon.hasOpenedSettings", undefined);
    context.globalState.update("falkon.walkthroughCompleted", undefined);
    context.globalState.update("falkon.walkthroughPromptDismissed", undefined);
  }

  const extensionId = context.extension.id.toLowerCase();
  const currentVersion: string = context.extension.packageJSON.version;

  console.log(`Falkon: extensionId = "${extensionId}", version = "${currentVersion}"`);

  // Status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "falkon.checkCli";
  context.subscriptions.push(statusBarItem);

  // Link status bar to the welcome module
  setWelcomeStatusBarItem(statusBarItem);

  // Debug configuration provider (intercepts F5 for .flk files)
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider("falkon", new FalkonDebugConfigurationProvider())
  );

  // Command: falkon.buildAndRun
  context.subscriptions.push(
    vscode.commands.registerCommand("falkon.buildAndRun", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor.");
        return;
      }
      if (!isFalkonFile(editor.document.uri.fsPath)) {
        vscode.window.showWarningMessage("Active file is not a .flk Falkon source file.");
        return;
      }
      await buildAndRun(editor.document);
    })
  );

  let hasPromptedThisSession = false;

  const triggerOnboardingPrompt = () => {
    if (hasPromptedThisSession) {
      return;
    }
    const isCompleted = context.globalState.get<boolean>("falkon.walkthroughCompleted", false);
    const isDismissed = context.globalState.get<boolean>("falkon.walkthroughPromptDismissed", false);

    if (!isCompleted && !isDismissed) {
      hasPromptedThisSession = true;
      vscode.window.showInformationMessage(
        "Welcome to Falkon! Get started by verifying the compiler CLI and configuring your shortcuts.",
        "Open Walkthrough",
        "Don't Show Again"
      ).then((selection) => {
        if (selection === "Open Walkthrough") {
          context.globalState.update("falkon.walkthroughPromptDismissed", true);
          vscode.commands.executeCommand("falkon.showWalkthrough");
        } else if (selection === "Don't Show Again") {
          context.globalState.update("falkon.walkthroughPromptDismissed", true);
        }
      });
    }
  };

  // Command: falkon.checkCli
  context.subscriptions.push(
    vscode.commands.registerCommand("falkon.checkCli", async () => {
      context.globalState.update("falkon.hasVerifiedCli", true);
      checkCompletionStatus(context);
      if (statusBarItem) {
        await checkFalkonInstallation(statusBarItem, true);
      }
    })
  );

  // Command: falkon.openSettings
  context.subscriptions.push(
    vscode.commands.registerCommand("falkon.openSettings", () => {
      context.globalState.update("falkon.hasOpenedSettings", true);
      checkCompletionStatus(context);
      vscode.commands.executeCommand("workbench.action.openSettings", "falkon");
    })
  );

  // Command: falkon.showWalkthrough (opens our custom welcome webview)
  context.subscriptions.push(
    vscode.commands.registerCommand("falkon.showWalkthrough", () => {
      showWelcomeWebview(context);
    })
  );

  // Command: falkon.resetOnboarding
  context.subscriptions.push(
    vscode.commands.registerCommand("falkon.resetOnboarding", async () => {
      await context.globalState.update("falkon.hasVerifiedCli", undefined);
      await context.globalState.update("falkon.hasOpenedSettings", undefined);
      await context.globalState.update("falkon.walkthroughCompleted", undefined);
      await context.globalState.update("falkon.walkthroughPromptDismissed", undefined);
      hasPromptedThisSession = false;
      hasShownInSession = false;
      if (welcomePanel) {
        welcomePanel.webview.postMessage({ command: "resetProgress" });
      } else {
        showWelcomeWebview(context);
      }
      vscode.window.showInformationMessage("Falkon onboarding state has been reset.");
    })
  );

  // Listen for config changes to track shortcut configuration step completion
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("falkon.shortcutPreset") || e.affectsConfiguration("falkon.enableDebugIntercept")) {
        context.globalState.update("falkon.hasOpenedSettings", true);
        checkCompletionStatus(context);
      }
    })
  );

  // Status bar: show only when a .flk file is active
  const updateStatusBar = (editor?: vscode.TextEditor) => {
    if (!statusBarItem) { return; }
    if (editor && isFalkonFile(editor.document.uri.fsPath)) {
      statusBarItem.show();
      triggerOnboardingPrompt();
    } else {
      statusBarItem.hide();
    }
  };
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar));
  updateStatusBar(vscode.window.activeTextEditor);

  // Silent CLI check on activation to set initial status bar state
  checkFalkonInstallation(statusBarItem, false);

  // ─── Auto-open welcome page ────────────────────────────────────────────────
  const lastVersion = context.globalState.get<string>("lastVersion");
  
  // If version changes (update scenario), reset completion states so onboarding runs again
  if (lastVersion && lastVersion !== currentVersion) {
    context.globalState.update("falkon.walkthroughCompleted", undefined);
    context.globalState.update("falkon.hasVerifiedCli", undefined);
    context.globalState.update("falkon.hasOpenedSettings", undefined);
  }

  const isCompleted = context.globalState.get<boolean>("falkon.walkthroughCompleted", false);
  if (!isCompleted && (!hasShownInSession || lastVersion !== currentVersion)) {
    hasShownInSession = true;
    context.globalState.update("lastVersion", currentVersion);
    console.log("Falkon: scheduling welcome page open");
    setTimeout(() => {
      console.log("Falkon: opening welcome page");
      showWelcomeWebview(context);
    }, 1000);
  }

  // Register Webview Serializer to restore the Welcome tab on VS Code restart
  if (vscode.window.registerWebviewPanelSerializer) {
    vscode.window.registerWebviewPanelSerializer("falkonWelcome", {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
        setupWelcomeWebview(webviewPanel, context);
      }
    });
  }
}

export function deactivate(): void {
  clearWelcomePanel();
}
