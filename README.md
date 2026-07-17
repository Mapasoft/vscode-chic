# Chic Language — VS Code Extension

VS Code support for the [Chic programming language](https://github.com/martinparadis/chic): syntax highlighting, semantic tokens, symbols, folding, snippets, a file icon, and build commands.

## Features

### Syntax Highlighting
Grammar support for `.chic` files, including keywords, types, operators, strings, comments, and annotations. The extension also adds lightweight semantic coloring for declarations, PascalCase types, enum cases, constants, and decorators.

### Navigation

- Document symbols for `func`, `struct`, `enum`, `union`, `raw_union`, and `alias` declarations
- Folding for brace blocks and block comments

### Snippets

| Prefix    | Expands to              |
|-----------|-------------------------|
| `func`    | `name : func` declaration |
| `struct`  | `Name : struct` declaration |
| `enum`    | `Name : enum` declaration |
| `for`     | For-in loop             |
| `if`      | If block                |
| `ifelse`  | If-else block           |
| `import`  | Import statement        |
| `alias`   | Type alias              |
| `ext`     | `@extension` function   |

### Build Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

- **Chic: Build Project** — runs `chic build <projectRoot> -out <projectRoot>/bin/<projectName>`
- **Chic: Build Project with Debug Info** — runs the same build command and appends `-g`
- **Chic: Run Compiled Program** — runs `<projectRoot>/bin/<projectName>` in a VS Code terminal
- **Chic: Init Project** — runs `chic init` in the current folder

Pressing `F7` while editing a Chic file also runs **Chic: Build Project**.

The project root is determined by walking up the directory tree until a `chic.toml` file is found, then falling back to the current workspace folder.

### File Icon
Adds a Chic file icon for `.chic` files. Enable it via **File > Preferences > File Icon Theme > Chic File Icons**.

## Requirements

The extension resolves the compiler from `chic.compilerPath`, `CHIC_DIR/bin/chic`, `PATH`, or common project-local build paths such as `bin/chic` and `cmake-build-debug/chic`.

## Settings

| Setting                 | Default  | Description                                      |
|-------------------------|----------|--------------------------------------------------|
| `chic.compilerPath`     | `""`     | Optional path to the Chic compiler executable    |
| `chic.executablePath`   | `"chic"` | Legacy compiler path setting                     |
| `chic.arguments`        | `""`     | Extra compiler arguments appended to build       |
| `chic.programArguments` | `""`     | Arguments passed to the compiled program         |

## Installation

### From the Marketplace
Search for **Chic Language** in the VS Code Extensions panel and click Install.

### From a `.vsix` file
```bash
code --install-extension vscode-chic-0.1.0.vsix
```
