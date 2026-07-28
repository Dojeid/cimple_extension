import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";
import * as fs from "fs";
import { checkFalkonInstallation } from "./compiler";

export let welcomePanel: vscode.WebviewPanel | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

export function setWelcomeStatusBarItem(item: vscode.StatusBarItem) {
  statusBarItem = item;
}

export function clearWelcomePanel() {
  welcomePanel = undefined;
}

function checkCompletionStatus(context: vscode.ExtensionContext) {
  const hasVerifiedCli = context.globalState.get<boolean>("falkon.hasVerifiedCli", false);
  const hasOpenedSettings = context.globalState.get<boolean>("falkon.hasOpenedSettings", false);
  if (hasVerifiedCli && hasOpenedSettings) {
    context.globalState.update("falkon.walkthroughCompleted", true);
  }
}

export function setupWelcomeWebview(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
  if (welcomePanel && welcomePanel !== panel) {
    welcomePanel.dispose();
  }
  welcomePanel = panel;

  // Convert SVG paths to webview URIs
  const welcomeSvgUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "resources", "images", "falkon 128x128.svg"))
  );
  const verifyCliSvgUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "resources", "images", "verify_cli.svg"))
  );
  const configureShortcutSvgUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, "resources", "images", "configure_shortcut.svg"))
  );

  // Load configuration
  const config = vscode.workspace.getConfiguration("falkon");
  const initialShortcutPreset = config.get<string>("shortcutPreset", "f4");
  const hasVerifiedCli = context.globalState.get<boolean>("falkon.hasVerifiedCli", false);
  const hasOpenedSettings = context.globalState.get<boolean>("falkon.hasOpenedSettings", false);

  // Load HTML Content with CSP source
  panel.webview.html = getWelcomeHtml(
    welcomeSvgUri,
    verifyCliSvgUri,
    configureShortcutSvgUri,
    initialShortcutPreset,
    hasVerifiedCli,
    hasOpenedSettings,
    panel.webview.cspSource
  );

  // Function to update CLI status inside webview
  const updateCliStatusInWebview = (status: "ready" | "missing", version?: string, isVerification?: boolean) => {
    panel.webview.postMessage({
      command: "updateCliStatus",
      status: status,
      version: version || "",
      isVerification: !!isVerification
    });
  };

  // Perform initial background CLI check to update badge silently (does NOT set isVerification = true)
  cp.exec("falkon -v", { timeout: 5000 }, (error, stdout, stderr) => {
    if (error) {
      context.globalState.update("falkon.hasVerifiedCli", undefined);
      checkCompletionStatus(context);
      updateCliStatusInWebview("missing", undefined, false);
    } else {
      const version = stdout.trim() || stderr.trim() || "unknown";
      updateCliStatusInWebview("ready", version, false);
    }
  });

  // Handle messages from Webview
  const messageListener = panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case "verifyCli": {
          // Check installation and send back result
          if (statusBarItem) {
            const isInstalled = await checkFalkonInstallation(statusBarItem, true);
            if (isInstalled) {
              context.globalState.update("falkon.hasVerifiedCli", true);
              checkCompletionStatus(context);
              cp.exec("falkon -v", { timeout: 5000 }, (error, stdout, stderr) => {
                const version = stdout.trim() || stderr.trim() || "unknown";
                updateCliStatusInWebview("ready", version, true);
              });
            } else {
              context.globalState.update("falkon.hasVerifiedCli", undefined);
              checkCompletionStatus(context);
              updateCliStatusInWebview("missing", undefined, true);
            }
          }
          break;
        }
        case "checkCliSilent": {
          if (statusBarItem) {
            checkFalkonInstallation(statusBarItem, false).then((isInstalled) => {
              if (isInstalled) {
                cp.exec("falkon -v", { timeout: 5000 }, (error, stdout, stderr) => {
                  const version = stdout.trim() || stderr.trim() || "unknown";
                  updateCliStatusInWebview("ready", version, false);
                });
              } else {
                context.globalState.update("falkon.hasVerifiedCli", undefined);
                checkCompletionStatus(context);
                updateCliStatusInWebview("missing", undefined, false);
              }
            });
          }
          break;
        }
        case "shortcutInteracted": {
          context.globalState.update("falkon.hasOpenedSettings", true);
          checkCompletionStatus(context);
          break;
        }
        case "changeShortcut": {
          const newPreset = message.preset;
          await vscode.workspace
            .getConfiguration("falkon")
            .update("shortcutPreset", newPreset, vscode.ConfigurationTarget.Global);
          context.globalState.update("falkon.hasOpenedSettings", true);
          checkCompletionStatus(context);
          break;
        }
        case "createFile": {
          // Create new hello.flk safely
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (workspaceFolders && workspaceFolders.length > 0) {
            const rootPath = workspaceFolders[0].uri.fsPath;
            const filePath = path.join(rootPath, "hello.flk");
            const fileUri = vscode.Uri.file(filePath);
            
            // Safety Check: Check if hello.flk already exists before writing
            try {
              await vscode.workspace.fs.stat(fileUri);
              // File exists, skip writing template to prevent data loss
            } catch {
              // File does not exist, safe to write template content
              const content = `# Falkon Source File\nprint("Hello from Falkon!")\n`;
              await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, "utf8"));
            }
            const doc = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(doc);
          } else {
            // Open an untitled file with default content
            const content = `# Falkon Source File\nprint("Hello from Falkon!")\n`;
            const doc = await vscode.workspace.openTextDocument({
              content: content,
              language: "falkon"
            });
            await vscode.window.showTextDocument(doc);
          }
          break;
        }
        case "close": {
          context.globalState.update("falkon.walkthroughCompleted", true);
          panel.dispose();
          break;
        }
        case "skip": {
          context.globalState.update("falkon.walkthroughCompleted", true);
          panel.dispose();
          break;
        }
      }
    },
    undefined,
    context.subscriptions
  );

  // Sync settings configuration changes
  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("falkon.shortcutPreset") || e.affectsConfiguration("falkon.enableDebugIntercept")) {
      const currentPreset = vscode.workspace
        .getConfiguration("falkon")
        .get<string>("shortcutPreset", "f4");
      panel.webview.postMessage({
        command: "updateSettings",
        shortcutPreset: currentPreset,
      });
    }
  });

  panel.onDidDispose(() => {
    if (welcomePanel === panel) {
      welcomePanel = undefined;
    }
    messageListener.dispose();
    configListener.dispose();
  });
}

export function showWelcomeWebview(context: vscode.ExtensionContext) {
  if (welcomePanel) {
    welcomePanel.reveal(vscode.ViewColumn.One);
    // Re-assign HTML and event listeners to ensure recovery from crashed/blank states
    setupWelcomeWebview(welcomePanel, context);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "falkonWelcome",
    "Welcome to Falkon",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        context.extensionUri,
      ],
    }
  );

  setupWelcomeWebview(panel, context);
}

function getWelcomeHtml(
  welcomeSvgUri: vscode.Uri,
  verifyCliSvgUri: vscode.Uri,
  configureShortcutSvgUri: vscode.Uri,
  initialShortcutPreset: string,
  initialVerifiedCli: boolean,
  initialOpenedSettings: boolean,
  cspSource: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https:; script-src 'unsafe-inline' ${cspSource}; style-src 'unsafe-inline' ${cspSource} https://fonts.googleapis.com https://fonts.gstatic.com; font-src https://fonts.gstatic.com;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Falkon</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: 'Outfit', var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      padding: 40px 24px;
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .container {
      max-width: 860px;
      width: 100%;
      animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      width: 120px;
      height: 120px;
      margin-bottom: 20px;
      border-radius: 50%;
      border: 3px solid rgba(138, 43, 226, 0.4);
      box-shadow: 0 0 20px rgba(138, 43, 226, 0.3);
      object-fit: cover;
      overflow: hidden;
      filter: drop-shadow(0 8px 16px rgba(138, 43, 226, 0.25));
      animation: float 4s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(-6px) rotate(1deg); }
    }
    h1 {
      font-size: 36px;
      font-weight: 800;
      margin: 0 0 12px 0;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #A855F7, #06B6D4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 16px;
      opacity: 0.75;
      margin: 0 auto;
      max-width: 600px;
      line-height: 1.5;
    }
    .progress-section {
      background: var(--vscode-welcomePage-tileBackground, rgba(255, 255, 255, 0.02));
      border: 1px solid var(--vscode-welcomePage-tileBorder, rgba(255, 255, 255, 0.08));
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 24px 32px;
      margin-bottom: 40px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }
    .progress-text {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      letter-spacing: 0.5px;
    }
    .progress-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #8A2BE2, #00FFFF, #8A2BE2);
      background-size: 200% auto;
      width: 0%;
      transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      animation: gradientShift 4s linear infinite;
    }
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .checklist {
      display: flex;
      gap: 36px;
      justify-content: center;
    }
    .check-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      opacity: 0.4;
      transition: all 0.4s ease;
    }
    .check-item.completed {
      opacity: 1;
      color: #00FF87;
      font-weight: 600;
      text-shadow: 0 0 10px rgba(0, 255, 135, 0.2);
    }
    .check-item .check-icon {
      font-size: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 28px;
      margin-bottom: 40px;
    }
    .card {
      background: var(--vscode-welcomePage-tileBackground, rgba(255, 255, 255, 0.03));
      border: 1px solid var(--vscode-welcomePage-tileBorder, rgba(255, 255, 255, 0.08));
      border-radius: 16px;
      padding: 36px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(138, 43, 226, 0.03) 0%, rgba(0, 255, 255, 0.03) 100%);
      opacity: 0;
      transition: opacity 0.4s ease;
      z-index: 0;
    }
    .card:hover::before {
      opacity: 1;
    }
    .card > * {
      position: relative;
      z-index: 1;
    }
    .card:hover {
      transform: translateY(-8px);
      border-color: rgba(0, 255, 255, 0.35);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.25), 0 0 20px rgba(138, 43, 226, 0.1);
    }
    .card-icon {
      width: 80px;
      height: 80px;
      margin-bottom: 20px;
      transition: transform 0.4s ease;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
    }
    .logo-icon {
      border-radius: 50%;
      border: 2px solid rgba(138, 43, 226, 0.4);
      box-shadow: 0 0 10px rgba(138, 43, 226, 0.3);
      object-fit: cover;
      overflow: hidden;
    }
    .card:hover .card-icon {
      transform: scale(1.08);
    }
    .card h2 {
      font-size: 18px;
      margin: 0 0 12px 0;
      font-weight: 700;
      letter-spacing: -0.25px;
    }
    .card p {
      font-size: 13px;
      line-height: 1.6;
      opacity: 0.7;
      margin: 0 0 24px 0;
      flex-grow: 1;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      font-size: 10px;
      font-weight: 700;
      border-radius: 30px;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 0.75px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }
    .badge-checking {
      background-color: var(--vscode-statusBarItem-warningBackground, #c97a00);
      color: var(--vscode-statusBarItem-warningForeground, #ffffff);
    }
    .badge-ready {
      background-color: #00FF87;
      color: #121214;
      box-shadow: 0 0 10px rgba(0, 255, 135, 0.3);
    }
    .badge-missing {
      background-color: #FF5F56;
      color: #ffffff;
    }
    .btn {
      background: linear-gradient(135deg, var(--vscode-button-background) 0%, rgba(138, 43, 226, 0.85) 100%);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 12px 20px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      transition: all 0.3s ease;
      box-sizing: border-box;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .btn:hover {
      filter: brightness(1.15);
      box-shadow: 0 6px 20px rgba(138, 43, 226, 0.35);
      transform: translateY(-1px);
    }
    .btn:active {
      transform: translateY(1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground));
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: none;
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .select-input {
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border, rgba(255, 255, 255, 0.15));
      padding: 12px 14px;
      font-size: 13px;
      border-radius: 8px;
      width: 100%;
      cursor: pointer;
      outline: none;
      box-sizing: border-box;
      transition: all 0.3s ease;
    }
    .select-input:hover, .select-input:focus {
      border-color: var(--vscode-focusBorder, #007fd4);
      box-shadow: 0 0 8px rgba(0, 127, 212, 0.25);
    }
    .footer {
      display: flex;
      justify-content: center;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 40px;
      gap: 20px;
    }
    .footer-btn {
      max-width: 200px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img class="logo" src="${welcomeSvgUri}" alt="Falkon Logo" />
      <h1>Welcome to Falkon</h1>
      <p class="subtitle">Sleek, Python-compatible syntax highlighting and build tools for VS Code.</p>
    </div>

    <!-- Onboarding Progress Section -->
    <div class="progress-section">
      <div class="progress-text">
        <span>Onboarding Progress</span>
        <span id="progress-percent">0%</span>
      </div>
      <div class="progress-bar">
        <div id="progress-fill" class="progress-fill" style="width: 0%;"></div>
      </div>
      <div class="checklist">
        <div class="check-item" id="check-cli">
          <span class="check-icon">○</span> Verify Falkon CLI
        </div>
        <div class="check-item" id="check-shortcut">
          <span class="check-icon">○</span> Configure Shortcut Preset
        </div>
      </div>
    </div>

    <div class="grid">
      <!-- Card 1: Compiler Check -->
      <div class="card">
        <img class="card-icon" src="${verifyCliSvgUri}" alt="CLI Check" />
        <h2>Verify Compiler CLI</h2>
        <span id="cli-badge" class="status-badge badge-checking">Checking...</span>
        <p>The Falkon compiler (falkon) must be installed and added to your system's PATH configuration.</p>
        <button id="btn-verify" class="btn">Run Verification</button>
      </div>

      <!-- Card 2: Configuration -->
      <div class="card">
        <img class="card-icon" src="${configureShortcutSvgUri}" alt="Shortcut" />
        <h2>Build & Run Shortcut</h2>
        <span style="height: 16px; margin-bottom: 16px;"></span> <!-- Spacer to align with badge -->
        <p>Select your default keyboard shortcut preset to compile and execute Falkon files inside the editor.</p>
        <select id="select-shortcut" class="select-input">
          <option value="f4" ${initialShortcutPreset === "f4" ? "selected" : ""}>F4 (Default)</option>
          <option value="ctrl+f5" ${initialShortcutPreset === "ctrl+f5" ? "selected" : ""}>Ctrl + F5</option>
          <option value="f7" ${initialShortcutPreset === "f7" ? "selected" : ""}>F7</option>
          <option value="none" ${initialShortcutPreset === "none" ? "selected" : ""}>None (Disabled)</option>
        </select>
      </div>

      <!-- Card 3: New File -->
      <div class="card">
        <img class="card-icon logo-icon" src="${welcomeSvgUri}" alt="Start Coding" />
        <h2>Start Coding</h2>
        <span style="height: 16px; margin-bottom: 16px;"></span> <!-- Spacer to align with badge -->
        <p>Initialize a new workspace with a sample template file and start compiling your Falkon projects.</p>
        <button id="btn-create-file" class="btn btn-secondary">Create hello.flk</button>
      </div>
    </div>

    <div class="footer">
      <button id="btn-skip" class="btn btn-secondary footer-btn">Skip / Do Later</button>
      <button id="btn-close" class="btn footer-btn">Finish Setup</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    let isCliReady = ${initialVerifiedCli};
    let isShortcutConfigured = ${initialOpenedSettings};

    function updateProgress() {
      let completedCount = 0;
      if (isCliReady) {
        completedCount++;
        document.getElementById('check-cli').classList.add('completed');
        document.getElementById('check-cli').querySelector('.check-icon').innerText = '✓';
      } else {
        document.getElementById('check-cli').classList.remove('completed');
        document.getElementById('check-cli').querySelector('.check-icon').innerText = '○';
      }

      if (isShortcutConfigured) {
        completedCount++;
        document.getElementById('check-shortcut').classList.add('completed');
        document.getElementById('check-shortcut').querySelector('.check-icon').innerText = '✓';
      } else {
        document.getElementById('check-shortcut').classList.remove('completed');
        document.getElementById('check-shortcut').querySelector('.check-icon').innerText = '○';
      }

      const percent = Math.round((completedCount / 2) * 100);
      document.getElementById('progress-percent').innerText = percent + '%';
      document.getElementById('progress-fill').style.width = percent + '%';

      const closeBtn = document.getElementById('btn-close');
      if (percent === 100) {
        closeBtn.innerText = 'Complete Setup 🎉';
        closeBtn.style.boxShadow = '0 0 12px rgba(0, 255, 135, 0.4)';
      } else {
        closeBtn.innerText = 'Finish Setup';
        closeBtn.style.boxShadow = 'none';
      }
    }

    document.getElementById('btn-verify').addEventListener('click', () => {
      const badge = document.getElementById('cli-badge');
      badge.className = 'status-badge badge-checking';
      badge.innerText = 'Checking...';
      vscode.postMessage({ command: 'verifyCli' });
    });

    const selectShortcut = document.getElementById('select-shortcut');
    const markShortcutConfigured = () => {
      if (!isShortcutConfigured) {
        isShortcutConfigured = true;
        updateProgress();
        vscode.postMessage({ command: 'shortcutInteracted' });
      }
    };

    selectShortcut.addEventListener('change', (e) => {
      markShortcutConfigured();
      vscode.postMessage({ command: 'changeShortcut', preset: e.target.value });
    });

    selectShortcut.addEventListener('click', markShortcutConfigured);
    selectShortcut.addEventListener('focus', markShortcutConfigured);

    document.getElementById('btn-create-file').addEventListener('click', () => {
      vscode.postMessage({ command: 'createFile' });
    });

    document.getElementById('btn-close').addEventListener('click', () => {
      vscode.postMessage({ command: 'close' });
    });

    document.getElementById('btn-skip').addEventListener('click', () => {
      vscode.postMessage({ command: 'skip' });
    });

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'resetProgress': {
          isCliReady = false;
          isShortcutConfigured = false;
          const selectElement = document.getElementById('select-shortcut');
          if (selectElement) {
            selectElement.value = 'f4';
          }
          const badge = document.getElementById('cli-badge');
          if (badge) {
            badge.className = 'status-badge badge-checking';
            badge.innerText = 'Checking...';
          }
          vscode.postMessage({ command: 'checkCliSilent' });
          updateProgress();
          break;
        }
        case 'updateSettings':
          document.getElementById('select-shortcut').value = message.shortcutPreset;
          isShortcutConfigured = true;
          updateProgress();
          break;
        case 'updateCliStatus': {
          const badge = document.getElementById('cli-badge');
          if (badge) {
            if (message.status === 'ready') {
              badge.className = 'status-badge badge-ready';
              badge.innerText = 'Ready (' + message.version + ')';
              if (message.isVerification) {
                isCliReady = true;
              }
            } else {
              badge.className = 'status-badge badge-missing';
              badge.innerText = 'Missing CLI';
              isCliReady = false;
            }
          }
          updateProgress();
          break;
        }
      }
    });

    // Run initial progress check
    updateProgress();
  </script>
</body>
</html>`;
}
