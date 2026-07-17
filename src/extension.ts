import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

const CHIC_SELECTOR: vscode.DocumentSelector = { language: "chic", scheme: "file" };

const semanticLegend = new vscode.SemanticTokensLegend(
  ["class", "function", "enumMember", "variable", "decorator"],
  ["declaration", "readonly"]
);

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("chic.build", () => runBuildTask({ debug: false })),
    vscode.commands.registerCommand("chic.buildDebug", () => runBuildTask({ debug: true })),
    vscode.commands.registerCommand("chic.run", () => runCompiledProgram()),
    vscode.commands.registerCommand("chic.init", () => runInitTask()),
    vscode.languages.registerDocumentSemanticTokensProvider(
      CHIC_SELECTOR,
      new ChicSemanticTokensProvider(),
      semanticLegend
    ),
    vscode.languages.registerFoldingRangeProvider(CHIC_SELECTOR, new ChicFoldingRangeProvider()),
    vscode.languages.registerDocumentSymbolProvider(CHIC_SELECTOR, new ChicDocumentSymbolProvider())
  );
}

export function deactivate(): void {}

interface ChicProject {
  root: string;
  outputExecutable: string;
}

interface BuildOptions {
  debug: boolean;
}

interface LineSemanticToken {
  start: number;
  length: number;
  tokenType: string;
  modifiers?: string[];
}

function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("chic");
}

function getConfiguredCompiler(): string {
  const config = getConfig();
  return (
    config.get<string>("compilerPath", "") ||
    config.get<string>("executablePath", "chic") ||
    "chic"
  ).trim();
}

function getCompilerArguments(): string[] {
  return splitCommandLine(getConfig().get<string>("arguments", ""));
}

function getProgramArguments(): string[] {
  return splitCommandLine(getConfig().get<string>("programArguments", ""));
}

function getWorkspaceRoot(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.uri.scheme === "file") {
    const fileDir = path.dirname(editor.document.uri.fsPath);
    return findProjectRoot(fileDir) ?? vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
  }

  const folders = vscode.workspace.workspaceFolders;
  return folders?.[0]?.uri.fsPath;
}

function getChicProject(): ChicProject | undefined {
  const root = getWorkspaceRoot();
  if (!root) {
    return undefined;
  }

  return {
    root,
    outputExecutable: path.join(root, "bin", path.basename(root)),
  };
}

function findProjectRoot(startDir: string): string | undefined {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, "chic.toml"))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return undefined;
}

function resolveCompiler(projectRoot?: string): string {
  const configured = getConfiguredCompiler();
  const candidates = [
    configured && configured !== "chic" ? configured : undefined,
    findInChicDir(),
    findOnPath("chic"),
    ...(projectRoot ? findProjectCandidates(projectRoot) : []),
    configured === "chic" ? "chic" : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find(isUsableCompiler) ?? configured ?? "chic";
}

function findInChicDir(): string | undefined {
  const chicDir = process.env.CHIC_DIR?.trim();
  if (!chicDir) {
    return undefined;
  }

  return [
    path.join(chicDir, "bin", executableName("chic")),
    path.join(chicDir, executableName("chic")),
  ].find(isUsableCompiler);
}

function findProjectCandidates(projectRoot: string): string[] {
  return [
    path.join(projectRoot, executableName("chic")),
    path.join(projectRoot, "bin", executableName("chic")),
    path.join(projectRoot, "build", executableName("chic")),
    path.join(projectRoot, "cmake-build-debug", executableName("chic")),
    path.join(projectRoot, "cmake-build-release", executableName("chic")),
  ];
}

function findOnPath(name: string): string | undefined {
  const pathValue = process.env.PATH ?? "";
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];

  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) {
      continue;
    }
    for (const extension of extensions) {
      const candidate = path.join(directory, executableName(name + extension.toLowerCase()));
      if (isUsableCompiler(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function executableName(name: string): string {
  if (process.platform !== "win32" || path.extname(name)) {
    return name;
  }
  return `${name}.exe`;
}

function isUsableCompiler(candidate: string): boolean {
  if (candidate === "chic") {
    return Boolean(findOnPath("chic"));
  }

  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

async function runBuildTask(options: BuildOptions): Promise<void> {
  const project = getChicProject();
  if (!project) {
    vscode.window.showErrorMessage("Chic: Open a Chic file or workspace folder first.");
    return;
  }

  const compiler = resolveCompiler(project.root);
  if (!isUsableCompiler(compiler)) {
    vscode.window.showWarningMessage(
      "Chic: Compiler was not found. Set chic.compilerPath or CHIC_DIR, or put chic on PATH."
    );
  }

  const args = ["build", project.root, "-out", project.outputExecutable, ...getCompilerArguments()];
  if (options.debug && !args.includes("-g")) {
    args.push("-g");
  }

  const taskName = options.debug ? "chic build debug" : "chic build";
  const task = new vscode.Task(
    { type: "chic", task: options.debug ? "buildDebug" : "build" },
    vscode.TaskScope.Workspace,
    taskName,
    "chic",
    new vscode.ShellExecution(compiler, args, { cwd: project.root }),
    "$chic"
  );

  task.group = vscode.TaskGroup.Build;
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Shared,
    clear: true,
  };

  await vscode.tasks.executeTask(task);
}

async function runInitTask(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("Chic: Open a folder before initializing a project.");
    return;
  }

  const compiler = resolveCompiler(root);
  const task = new vscode.Task(
    { type: "chic", task: "init" },
    vscode.TaskScope.Workspace,
    "chic init",
    "chic",
    new vscode.ShellExecution(compiler, ["init"], { cwd: root }),
    "$chic"
  );
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Shared,
    clear: true,
  };

  await vscode.tasks.executeTask(task);
}

function runCompiledProgram(): void {
  const project = getChicProject();
  if (!project) {
    vscode.window.showErrorMessage("Chic: Open a Chic file or workspace folder first.");
    return;
  }

  if (!fs.existsSync(project.outputExecutable)) {
    vscode.window.showErrorMessage(
      `Chic: ${project.outputExecutable} does not exist yet. Run "Chic: Build" first.`
    );
    return;
  }

  const terminal = vscode.window.createTerminal({
    name: "Chic Program",
    cwd: project.root,
  });
  terminal.show();

  const command = [project.outputExecutable, ...getProgramArguments()]
    .map(shellQuote)
    .join(" ");
  terminal.sendText(command);
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_/@%+=:,.-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function splitCommandLine(text: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: "'" | "\"" | undefined;
  let escaping = false;

  for (const char of text.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }
  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

class ChicSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(semanticLegend);

    for (let line = 0; line < document.lineCount; line++) {
      const text = document.lineAt(line).text;
      const tokens = collectLineSemanticTokens(text).sort((left, right) => left.start - right.start);
      for (const token of tokens) {
        pushSemantic(builder, line, token.start, token.length, token.tokenType, token.modifiers);
      }
    }

    return builder.build();
  }
}

function collectLineSemanticTokens(text: string): LineSemanticToken[] {
  const tokens: LineSemanticToken[] = [];
  addDeclarationTokens(tokens, text);
  addIdentifierTokens(tokens, text);
  return tokens;
}

function addDeclarationTokens(tokens: LineSemanticToken[], text: string): void {
  const declaration = /\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(func|struct|enum|union|raw_union|alias)\b/g;
  for (const match of text.matchAll(declaration)) {
    const name = match[1];
    const kind = match[2];
    const tokenType = kind === "func" ? "function" : "class";
    tokens.push({
      start: match.index ?? 0,
      length: name.length,
      tokenType,
      modifiers: ["declaration"],
    });
  }
}

function addIdentifierTokens(tokens: LineSemanticToken[], text: string): void {
  const tokenPattern = /@[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*/g;
  for (const match of text.matchAll(tokenPattern)) {
    const value = match[0];
    const start = match.index ?? 0;
    if (isInsideStringOrComment(text, start) || isDeclarationName(text, start)) {
      continue;
    }

    if (value.startsWith("@")) {
      tokens.push({ start, length: value.length, tokenType: "decorator" });
    } else if (isUpperSnakeCase(value)) {
      tokens.push({ start, length: value.length, tokenType: "variable", modifiers: ["readonly"] });
    } else if (isPascalCase(value) && isAfterDot(text, start)) {
      tokens.push({ start, length: value.length, tokenType: "enumMember" });
    } else if (isPascalCase(value)) {
      tokens.push({ start, length: value.length, tokenType: "class" });
    }
  }
}

function pushSemantic(
  builder: vscode.SemanticTokensBuilder,
  line: number,
  start: number,
  length: number,
  tokenType: string,
  modifiers: string[] = []
): void {
  const typeIndex = semanticLegend.tokenTypes.indexOf(tokenType);
  if (typeIndex === -1) {
    return;
  }
  builder.push(line, start, length, typeIndex, modifierMask(...modifiers));
}

function modifierMask(...modifiers: string[]): number {
  return modifiers.reduce((mask, modifier) => {
    const index = semanticLegend.tokenModifiers.indexOf(modifier);
    return index === -1 ? mask : mask | (1 << index);
  }, 0);
}

function isDeclarationName(text: string, start: number): boolean {
  const after = text.slice(start).match(/^[A-Za-z_][A-Za-z0-9_]*\s*:\s*(func|struct|enum|union|raw_union|alias)\b/);
  return Boolean(after);
}

function isInsideStringOrComment(text: string, start: number): boolean {
  const lineComment = text.indexOf("//");
  if (lineComment !== -1 && start >= lineComment) {
    return true;
  }

  let inString: "\"" | "'" | undefined;
  let escaping = false;
  for (let i = 0; i < start; i++) {
    const char = text[i];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (inString) {
      if (char === inString) {
        inString = undefined;
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      inString = char;
    }
  }

  return Boolean(inString);
}

function isAfterDot(text: string, start: number): boolean {
  let index = start - 1;
  while (index >= 0 && /\s/.test(text[index])) {
    index--;
  }
  return text[index] === ".";
}

function isPascalCase(value: string): boolean {
  return /^[A-Z]/.test(value) && /[a-z]/.test(value);
}

function isUpperSnakeCase(value: string): boolean {
  return value.length >= 2 && /^[A-Z0-9_]+$/.test(value) && /[A-Z]/.test(value);
}

class ChicFoldingRangeProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
    const ranges: vscode.FoldingRange[] = [];
    const stack: number[] = [];
    let blockCommentStart: number | undefined;

    for (let line = 0; line < document.lineCount; line++) {
      const text = stripStrings(document.lineAt(line).text);

      if (blockCommentStart === undefined) {
        const commentStart = text.indexOf("/*");
        if (commentStart !== -1) {
          blockCommentStart = line;
        }
      }
      if (blockCommentStart !== undefined && text.includes("*/") && line > blockCommentStart) {
        ranges.push(new vscode.FoldingRange(blockCommentStart, line, vscode.FoldingRangeKind.Comment));
        blockCommentStart = undefined;
      }

      const code = text.replace(/\/\/.*$/, "");
      for (const char of code) {
        if (char === "{") {
          stack.push(line);
        } else if (char === "}") {
          const start = stack.pop();
          if (start !== undefined && line > start) {
            ranges.push(new vscode.FoldingRange(start, line, vscode.FoldingRangeKind.Region));
          }
        }
      }
    }

    return ranges;
  }
}

function stripStrings(text: string): string {
  let result = "";
  let inString: "\"" | "'" | undefined;
  let escaping = false;

  for (const char of text) {
    if (escaping) {
      result += " ";
      escaping = false;
      continue;
    }
    if (char === "\\") {
      result += " ";
      escaping = true;
      continue;
    }
    if (inString) {
      if (char === inString) {
        inString = undefined;
      }
      result += " ";
      continue;
    }
    if (char === "\"" || char === "'") {
      inString = char;
      result += " ";
      continue;
    }
    result += char;
  }

  return result;
}

class ChicDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];
    const declaration = /\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(func|struct|enum|union|raw_union|alias)\b/g;

    for (let line = 0; line < document.lineCount; line++) {
      const text = document.lineAt(line).text;
      for (const match of text.matchAll(declaration)) {
        const name = match[1];
        const kind = symbolKind(match[2]);
        const start = match.index ?? 0;
        const selectionRange = new vscode.Range(line, start, line, start + name.length);
        const range = findDeclarationRange(document, line);
        symbols.push(new vscode.DocumentSymbol(name, match[2], kind, range, selectionRange));
      }
    }

    return symbols;
  }
}

function symbolKind(kind: string): vscode.SymbolKind {
  switch (kind) {
    case "func":
      return vscode.SymbolKind.Function;
    case "enum":
      return vscode.SymbolKind.Enum;
    case "struct":
    case "union":
    case "raw_union":
      return vscode.SymbolKind.Struct;
    case "alias":
      return vscode.SymbolKind.TypeParameter;
    default:
      return vscode.SymbolKind.Variable;
  }
}

function findDeclarationRange(document: vscode.TextDocument, startLine: number): vscode.Range {
  let depth = 0;
  let seenOpen = false;

  for (let line = startLine; line < document.lineCount; line++) {
    const text = stripStrings(document.lineAt(line).text).replace(/\/\/.*$/, "");
    for (const char of text) {
      if (char === "{") {
        depth++;
        seenOpen = true;
      } else if (char === "}") {
        depth--;
        if (seenOpen && depth <= 0) {
          return new vscode.Range(startLine, 0, line, document.lineAt(line).text.length);
        }
      }
    }
    if (!seenOpen && line > startLine) {
      break;
    }
  }

  return document.lineAt(startLine).range;
}
