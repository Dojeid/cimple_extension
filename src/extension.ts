import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Cimple language support is active.');

  // Nothing else needs to run right now; the language is handled entirely by the grammar.
  context.subscriptions.push(
    new vscode.Disposable(() => {
      console.log('Cimple language support is being disposed.');
    })
  );
}

export function deactivate() {
  // Intentionally empty; no cleanup needed yet.
}
