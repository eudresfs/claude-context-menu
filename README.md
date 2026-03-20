# claude-context-menu

> Right-click any folder in Windows Explorer and open Claude directly in that directory.

[![npm version](https://img.shields.io/npm/v/claude-context-menu?style=flat-square&color=cc785c)](https://www.npmjs.com/package/claude-context-menu)
[![license](https://img.shields.io/npm/l/claude-context-menu?style=flat-square)](LICENSE)
[![platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078d4?style=flat-square&logo=windows)](https://github.com/eudresfs/claude-context-menu)
[![node](https://img.shields.io/node/v/claude-context-menu?style=flat-square&color=339933&logo=node.js)](https://nodejs.org)
[![build](https://img.shields.io/github/actions/workflow/status/eudresfs/claude-context-menu/build-dll.yml?style=flat-square&label=DLL+build)](https://github.com/eudresfs/claude-context-menu/actions)

---

## Overview

`claude-context-menu` adds an **"Open with Claude"** entry to the Windows Explorer right-click menu — both on folders and on the folder background. Clicking it opens a terminal in that directory and launches `claude` automatically.

```
Right-click a folder
│
├─ Open                         (Windows built-in)
├─ Open in Terminal             (Windows built-in)
└─ Open with Claude             ← this package adds this
```

Two integration modes are supported, depending on whether the prebuilt native DLL is present:

| Mode | Menu | Requires |
|---|---|---|
| **Modern** (DLL) | Windows 11 new-style menu + classic | Prebuilt `claude-context-menu.dll` |
| **Classic** (fallback) | Classic menu only ("Show more options") | Nothing extra |

---

## Prerequisites

| Requirement | Notes |
|---|---|
| [Claude CLI](https://claude.ai/download) | Must be reachable via `claude` in PATH |
| [Node.js](https://nodejs.org) ≥ 18 | Required to run the installer |
| Windows 10 / 11 | x64 |
| PowerShell | Built-in; pwsh 7+ auto-detected if installed |

---

## Installation

```bash
npx claude-context-menu install
```

Or install globally first:

```bash
npm install -g claude-context-menu
claude-context-menu install
```

The installer will ask three questions and then register the context menu entry:

```
┌  claude-context-menu  ·  install
│
◇  Label shown in context menu
│  Open with Claude
│
◇  Extra Claude flags  (leave empty for none)
│
◇  Open terminal in
│  PowerShell 7+ (pwsh)
│
◇  Registry entries written
│
┌─────────────────────────────────────────┐
│  Configuration                          │
│  Shell  : PowerShell 7+ (pwsh)          │
│  Claude : C:\...\claude.exe             │
│  Mode   : Modern + Classic menu (DLL)   │
└─────────────────────────────────────────┘
│
└  Done. Right-click a folder and look for "Open with Claude"
```

> No administrator privileges required — everything is registered under `HKCU`.

---

## Commands

| Command | Description |
|---|---|
| `claude-context-menu install` | Interactive installer — registers the context menu entry |
| `claude-context-menu uninstall` | Removes all registry entries |
| `claude-context-menu doctor` | Diagnoses your environment and registration status |

### `doctor` output example

```
┌  claude-context-menu  ·  doctor
│
✔  claude found: C:\Users\you\AppData\Local\Programs\claude\claude.exe
✔  pwsh found: C:\Program Files\PowerShell\7\pwsh.exe
✔  Windows Terminal found: C:\...\wt.exe   (optional)
✔  DLL found: C:\...\prebuilt\claude-context-menu.dll
✔  CLSID registered  (modern menu active)
✔  Verb registered  (folder background)
✔  Verb registered  (folder click)
✔  Config key found
│
└  Done.
```

---

## How it works

### Classic menu (fallback)

A plain registry verb is written under `HKCU\Software\Classes\Directory\...\shell\Claude`. Explorer reads it and adds the entry to the "Show more options" (classic) menu. No binaries needed.

### Modern menu (DLL)

A small native DLL (`claude-context-menu.dll`) implements the [`IExplorerCommand`](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-iexplorercommand) COM interface. The installer:

1. Registers the DLL as a COM in-process server under `HKCU\Software\Classes\CLSID\{GUID}`
2. Writes your configuration to `HKCU\Software\ClaudeContextMenu`
3. Registers the verb with `ExplorerCommandHandler = {GUID}` — this is what makes the item appear in the Windows 11 modern menu

At click time, Explorer loads the DLL, calls `IExplorerCommand::Invoke`, which reads config from the registry and calls `CreateProcess` to launch your terminal.

```
Explorer right-click
    │
    └─ IExplorerCommand::Invoke(IShellItemArray*)
           │
           ├─ GetDisplayName(SIGDN_FILESYSPATH) → "C:\path\to\folder"
           ├─ ReadConfig(HKCU\Software\ClaudeContextMenu)
           └─ CreateProcess("pwsh.exe -NoExit -Command \"Set-Location '...'; claude\"")
```

---

## Configuration

Configuration is stored in `HKCU\Software\ClaudeContextMenu` and set by the installer. To change it, run `install` again.

| Value | Type | Description |
|---|---|---|
| `Label` | `REG_SZ` | Text shown in the context menu |
| `Shell` | `REG_SZ` | Full path to `pwsh.exe` or `powershell.exe` |
| `ExtraFlags` | `REG_SZ` | Extra flags passed to `claude` (e.g. `--model opus`) |
| `ClaudePath` | `REG_SZ` | Path to `claude.exe` — used as the menu icon source |
| `UseWindowsTerminal` | `REG_DWORD` | `1` to open in Windows Terminal, `0` for standalone window |
| `WtPath` | `REG_SZ` | Full path to `wt.exe` (written only when Windows Terminal is selected) |

---

## Building the DLL from source

The native DLL is pre-compiled and shipped with the npm package. You only need to build if you're contributing to the C++ code.

**Requirements:** Visual Studio 2022 with the **"Desktop development with C++"** workload, or the standalone **Build Tools**.

```bash
# Clone the repo
git clone https://github.com/eudresfs/claude-context-menu
cd claude-context-menu

# Configure and build (x64 Release)
cmake -B build -S native -A x64
cmake --build build --config Release

# Output: prebuilt/claude-context-menu.dll
```

The GitHub Actions workflow (`.github/workflows/build-dll.yml`) runs this automatically on every push to `main` that touches `native/**` and commits the result to `prebuilt/`.

---

## Project structure

```
claude-context-menu/
├── bin/
│   └── cli.js                  Entry point — routes to scripts/
├── scripts/
│   ├── install.js              Interactive installer
│   ├── uninstall.js            Uninstaller
│   └── doctor.js               Environment diagnostics
├── native/
│   ├── CMakeLists.txt
│   ├── exports.def
│   └── src/
│       ├── dllmain.cpp         DllGetClassObject / DllCanUnloadNow
│       ├── command.hpp/.cpp    IExplorerCommand implementation
│       └── factory.hpp/.cpp    IClassFactory implementation
├── prebuilt/
│   └── claude-context-menu.dll Pre-compiled DLL (committed by CI)
└── .github/
    └── workflows/
        └── build-dll.yml       Builds and commits the DLL on C++ changes
```

---

## Uninstalling

```bash
claude-context-menu uninstall
```

This removes:
- Both verb registry entries (`Directory\shell` and `Directory\Background\shell`)
- The COM server registration (`HKCU\Software\Classes\CLSID\{GUID}`)
- The configuration key (`HKCU\Software\ClaudeContextMenu`)

---

## Contributing

Contributions are welcome. A few notes before opening a PR:

- **JS changes** (installer UX, logic): no build step needed
- **C++ changes** (DLL behavior, COM interface): run the CMake build locally and commit the updated DLL under `prebuilt/`, or let CI do it
- Keep the installer interactive flow minimal — every extra question adds friction

```bash
git clone https://github.com/eudresfs/claude-context-menu
cd claude-context-menu
npm install
npm link   # register the CLI globally for local testing
claude-context-menu doctor
```

---

## License

[MIT](LICENSE) — © eudresfs
