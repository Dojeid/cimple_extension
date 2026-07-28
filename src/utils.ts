import * as path from "path";

const FALKON_EXTENSIONS = new Set([".flk"]);

export function isFalkonFile(fsPath: string): boolean {
  return FALKON_EXTENSIONS.has(path.extname(fsPath).toLowerCase());
}
