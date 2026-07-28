import * as vscode from "vscode";
import { isFalkonFile } from "./utils";
import { buildAndRun } from "./compiler";

export class FalkonDebugConfigurationProvider
  implements vscode.DebugConfigurationProvider
{
  provideDebugConfigurations(
    folder: vscode.WorkspaceFolder | undefined,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [{ type: "falkon", name: "Launch", request: "launch" }];
  }

  async resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    token?: vscode.CancellationToken
  ): Promise<vscode.DebugConfiguration | undefined> {
    const falkonConfig = vscode.workspace.getConfiguration("falkon");
    if (!falkonConfig.get<boolean>("enableDebugIntercept", true)) {
      return undefined;
    }

    if (!config.type && !config.request && !config.name) {
      config.type = "falkon";
      config.name = "Launch";
      config.request = "launch";
    }

    const editor = vscode.window.activeTextEditor;
    if (editor && isFalkonFile(editor.document.uri.fsPath)) {
      await buildAndRun(editor.document);
    } else {
      vscode.window.showErrorMessage(
        editor ? "Active file is not a .flk file." : "No active Falkon file to run."
      );
    }

    return undefined;
  }
}
