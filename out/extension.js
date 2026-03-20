"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const CIMPLE_EXTENSIONS = new Set([".cimp"]);
function isCimpleFile(fsPath) {
    return CIMPLE_EXTENSIONS.has(path.extname(fsPath).toLowerCase());
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
    // Find existing Cimple terminal or create a new one
    let terminal = vscode.window.terminals.find((t) => t.name === "Cimple Run");
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
class CimpleDebugConfigurationProvider {
    /**
     * Provide initial debug configurations.
     */
    provideDebugConfigurations(folder, token) {
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
    async resolveDebugConfiguration(folder, config, token) {
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
            }
            else {
                console.log("Cimple Debug: NOT a Cimple file");
                vscode.window.showErrorMessage("Active file is not a .cimp file.");
            }
        }
        else {
            console.log("Cimple Debug: No active editor");
            vscode.window.showErrorMessage("No active Cimple file to run.");
        }
        return undefined; // Abort the actual debug session launch as we handle it via terminal
    }
}
function activate(context) {
    console.log("Cimple extension is now active!");
    // Register the debug configuration provider
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('cimple', new CimpleDebugConfigurationProvider()));
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
function deactivate() { }
//# sourceMappingURL=extension.js.map