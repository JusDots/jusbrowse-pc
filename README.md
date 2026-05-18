# JusBrowse — The Browser of JusDots on PC

The Windows and Linux version of the JusDots Android browser **JusBrowse**.

A privacy-first Chromium desktop browser with native adblock, anti-fingerprinting, customizable home page, and a floating control pill.

**Current release:** [v2.1.0 "Atlantis"](https://github.com/JusDots/jusbrowse-pc/releases/tag/v2.1.0)

---

## Features

- **Floating control pill** — bottom or top-bar mode with smooth slide-in/out animations
- **Chrome-style tab strip** — tabs-at-top and tabs-at-bottom layouts
- **Network adblock + cosmetic CSS adblock** — expanded ad/tracker filtering heuristics
- **YouTube ad blocking** — in-player ad auto-skip plus cosmetic blocking
- **Anti-fingerprinting** — UA spoofing, navigator hardening, `AutomationControlled` disabled
- **Smart URL bar** — plain text queries trigger search instead of broken navigation
- **Home page sticker decorations** — PNG/GIF support with drag and resize
- **Dark glass UI** — theme presets with built-in gradients and proper layering
- **Browsing shortcuts** — F5, F11, Ctrl+T/W, Ctrl+L, Alt+Left/Right, zoom, and more
- **Password capture pipeline** — URL-encoded, JSON, and multipart form support
- **Right-click context menu** for BrowserView
- **Incognito mode** routed through tab UI

---

## Downloads

| Platform | File | Size |
| --- | --- | --- |
| **Windows 10/11** (64-bit) | `JusBrowse-2.1.0-win-x64.exe` | 96 MB |
| **Debian / Ubuntu / Mint / Pop!\_OS / Kali** | `JusBrowse-2.1.0-linux-amd64.deb` | 79 MB |
| **Fedora / RHEL / openSUSE** | `JusBrowse-2.1.0-linux-x64.rpm` | 74 MB |
| **Arch / Manjaro / EndeavourOS / Garuda** | `JusBrowse-2.1.0-linux-x64.pacman` | 79 MB |
| **Any Linux distro** (universal) | `JusBrowse-2.1.0-linux-x86_64.AppImage` | 115 MB |

Get all artifacts from the [Releases page](https://github.com/JusDots/jusbrowse-pc/releases).

---

## Installation

### Windows

Double-click the `.exe` — the NSIS installer wizard guides you through Start Menu and Desktop shortcut creation.

### Debian-based Linux

```bash
sudo apt install ./JusBrowse-2.1.0-linux-amd64.deb
```

### Fedora / RHEL / openSUSE

```bash
sudo dnf install ./JusBrowse-2.1.0-linux-x64.rpm
# or:
sudo rpm -i JusBrowse-2.1.0-linux-x64.rpm
```

### Arch-based Linux

```bash
sudo pacman -U JusBrowse-2.1.0-linux-x64.pacman
```

### AppImage (any distro)

```bash
chmod +x JusBrowse-2.1.0-linux-x86_64.AppImage
./JusBrowse-2.1.0-linux-x86_64.AppImage
```

---

## Build from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm (ships with Node.js)

### Setup

```bash
git clone https://github.com/JusDots/jusbrowse-pc.git
cd jusbrowse-pc
npm install
```

### Run

```bash
npm start
# On Linux, if sandbox issues occur:
npm run start:linux-safe
```

### Build Installers

```bash
# All platforms (from Linux or Windows)
npm run dist:all

# Linux only (deb + pacman)
npm run dist:linux

# Linux deb only
npm run dist:linux:deb

# Linux rpm only
npm run dist:linux:rpm

# Linux Arch pacman only
npm run dist:linux:arch

# Windows only
npm run dist:win
```

Built artifacts land in `dist/`.

---

## Path A Release Readiness

JusBrowse uses a structured release gate system (`patha:*` scripts) to validate cutover readiness:

```bash
# Run all readiness checks
npm run patha:ready-linux-win

# Individual checks
npm run patha:auto-check          # Automated parity check
npm run patha:manual-parity       # Manual parity matrix
npm run patha:staged-rollout      # Staged rollout checks
npm run patha:flagship-ready      # Flagship readiness assessment
npm run patha:bundle-readiness    # Generate readiness bundle
```

Run tests with `npm test`.

---

## Project Structure

```
jusbrowse-pc/
├── electron/           # Electron main process & preload scripts
├── ui/                 # Renderer UI (HTML, CSS, JS)
├── build/              # App icons and build assets
├── JB_C/path-a/        # Release readiness gate system
├── dist/               # Built installer artifacts
├── package.json        # Project config & electron-builder settings
└── README.md           # This file
```

---

## Known Limitations

- **Google sign-in in same-window mode** is constrained by provider embedded-auth policy. v2.1.0 detects the rejection deterministically and offers a system-browser continuation path. Full in-window Google account flow is targeted in a future release.

---

## License

[MIT](LICENSE)

---

> Made with ❤️ and dots(.) by JusDots Labs
