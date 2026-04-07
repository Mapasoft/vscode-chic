# Chic Language — VS Code Extension

VS Code support for the [Chic programming language](https://github.com/martinparadis/chic): syntax highlighting, snippets, a file icon, and build commands.

## Features

### Syntax Highlighting
Full grammar support for `.chic` files, including keywords, types, operators, strings, comments, and annotations.

### Snippets

| Prefix    | Expands to              |
|-----------|-------------------------|
| `func`    | Function declaration    |
| `struct`  | Struct declaration      |
| `enum`    | Enum declaration        |
| `for`     | For-in loop             |
| `if`      | If block                |
| `ifelse`  | If-else block           |
| `import`  | Import statement        |
| `alias`   | Type alias              |
| `ext`     | Extension method block  |

### Build Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

- **Chic: Build** — runs `chic build` in the project root
- **Chic: Run** — runs `chic run` in the project root
- **Chic: Init Project** — runs `chic init` in the current folder

The project root is determined by walking up the directory tree until a `chic.toml` file is found.

### File Icon
Adds a Chic file icon for `.chic` files. Enable it via **File > Preferences > File Icon Theme > Chic File Icons**.

## Requirements

The `chic` compiler must be installed and available on your `$PATH`, or you can set a custom path in the extension settings.

## Settings

| Setting               | Default  | Description                                      |
|-----------------------|----------|--------------------------------------------------|
| `chic.executablePath` | `"chic"` | Path to the chic compiler executable             |

## Installation

### From the Marketplace
Search for **Chic Language** in the VS Code Extensions panel and click Install.

### From a `.vsix` file
```bash
code --install-extension vscode-chic-0.1.0.vsix
```
