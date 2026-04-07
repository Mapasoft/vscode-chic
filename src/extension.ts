import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("chic.build", () => runChicCommand("build")),
    vscode.commands.registerCommand("chic.run",   () => runChicCommand("run")),
    vscode.commands.registerCommand("chic.init",  () => runChicCommand("init"))
  );
}

export function deactivate(): void {}

// ---------------------------------------------------------------------------

function getChicExecutable(): string {
  return vscode.workspace
    .getConfiguration("chic")
    .get<string>("executablePath", "chic");
}

/** Walk up from startDir until chic.toml is found; return that directory. */
function findProjectRoot(startDir: string): string | undefined {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, "chic.toml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break; // reached filesystem root
    }
    dir = parent;
  }
  return undefined;
}

/** Resolve the working directory for a chic command. */
function getWorkingDirectory(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const fileDir = path.dirname(editor.document.uri.fsPath);
    const root = findProjectRoot(fileDir);
    if (root) {
      return root;
    }
  }
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return undefined;
}

async function runChicCommand(command: string): Promise<void> {
  const cwd = getWorkingDirectory();
  if (!cwd) {
    vscode.window.showErrorMessage(
      "Chic: No workspace folder is open. Open a folder that contains chic.toml."
    );
    return;
  }

  const exe = getChicExecutable();
  const task = new vscode.Task(
    { type: "shell", command: `${exe} ${command}` },
    vscode.TaskScope.Workspace,
    `chic ${command}`,
    "chic",
    new vscode.ShellExecution(`${exe} ${command}`, { cwd }),
    "$chic"
  );
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Shared,
    clear: true,
  };

  await vscode.tasks.executeTask(task);
}
