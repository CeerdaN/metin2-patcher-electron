<p align="center"><img src="./app/assets/images/SealCircle.png" width="150px" height="150px" alt="Metin2 Launcher"></p>

<h1 align="center">Metin2 Custom Launcher</h1>

<p align="center">
  <em>A fully-featured, customizable game launcher for Metin2 private servers</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/node-20.x-green?style=for-the-badge" alt="Node">
  <img src="https://img.shields.io/badge/electron-33.x-blueviolet?style=for-the-badge" alt="Electron">
  <img src="https://img.shields.io/badge/license-Open%20Source-orange?style=for-the-badge" alt="License">
</p>

<p align="center">
  A modern, professional launcher built with Electron for Metin2 private servers. Features automatic file verification, MD5 hash checking, smart updates, and a beautiful UI. Ready to customize for your own server!
</p>

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Customization Guide](#customization-guide)
- [How It Works](#how-it-works)
- [For Players](#for-players)
- [For Developers](#for-developers)
- [Server Setup Requirements](#server-setup-requirements)
  - [Included Example API Files](#-included-example-files)
  - [Manifest File Setup](#1-manifest-file-manifestjson)
  - [Game Files Hosting](#2-game-files-hosting)
  - [Discord Rich Presence](#4-discord-rich-presence-setup-optional)
- [Building & Distribution](#building--distribution)
- [Technical Architecture](#technical-architecture)
- [Credits](#credits)
- [License](#license)

---

## Features

### Automatic Game Management
- **Smart File Patcher**: Automatically downloads and verifies all game files using MD5 hash verification
- **Intelligent Version Control**: Only downloads files that are missing, corrupted, or outdated
- **Optimized Downloads**: Built-in download speed limiting (configurable, default 20 MB/s)
- **Manifest Caching**: Reduces server load by caching file manifests for 5 minutes
- **Resume Support**: Can resume interrupted downloads

### User Experience
- **One-Click Launch**: Players simply click "Play" and the launcher handles everything else
- **Real-Time Progress**: Visual progress bars and detailed status updates during downloads
- **Discord Rich Presence**: Show players' friends what they're playing (optional)
- **News Feed**: RSS-based news feed integrated into the launcher
- **Auto-Updater**: Launcher automatically updates itself when new versions are available
- **Beautiful UI**: Modern, professional interface built with Electron

### Technical Features
- **File Integrity Verification**: All game files verified using MD5 checksums before launch
- **Automatic Channel Configuration**: Creates and manages `channel.inf` file automatically
- **Cross-Platform Support**: Works on Windows, macOS, and Linux
- **Modern Tech Stack**: Built with Electron, Node.js 20, and modern JavaScript
- **Efficient Asset Management**: Only downloads what's needed, when it's needed
- **Background Updates**: Non-intrusive update system

---

## Quick Start

### For Server Owners (Customization)

**Want to use this launcher for your Metin2 server?** Follow these steps:

1. **Clone this repository**
   ```bash
   git clone https://github.com/CeerdaN/metin2-patcher-electron.git
   cd metin2-patcher-electron
   npm install
   ```

2. **Customize the launcher** (see [Customization Guide](#customization-guide) below)

3. **Test it**
   ```bash
   npm start
   ```

4. **Build installers**
   ```bash
   npm run dist
   ```

5. **Distribute to your players!**

### For Players

1. Download the launcher from your server's website
2. Install and run the launcher
3. Wait for initial file verification (first launch only)
4. Click "Play" and enjoy!

---

## Customization Guide

This launcher is a **template ready for customization**. Here's everything you need to change to make it yours:

### 📝 Step 1: Basic Configuration Files

#### `package.json`
Update your server information:
```json
{
  "name": "metin2launcher",              // Change to: yourservername-launcher
  "productName": "YourServerName Launcher", // Your launcher display name
  "description": "Custom launcher for YourServerName Metin2 private server",
  "author": "YourName",                  // Your name or team name
  "homepage": "https://yoursite.com",    // Your website
  "bugs": {
    "url": "https://yoursite.com/support" // Your support URL
  },
  "repository": {
    "url": "git+https://github.com/yourusername/metin2-patcher-electron.git"
  }
}
```

#### `distribution.json`
Configure server and Discord settings:
```json
{
  "discord": {
    "clientId": "YOUR_DISCORD_CLIENT_ID",  // Get from Discord Developer Portal
    "smallImageText": "YourServerName",
    "smallImageKey": "your-logo-key"
  },
  "rss": "https://yoursite.com/news.rss",  // Your news RSS feed
  "servers": [
    {
      "id": "YourServer-Main",
      "name": "YourServerName",
      "description": "Your Metin2 Server Description",
      "icon": "https://yoursite.com/icon.png",
      "address": "yourserver.com"
    }
  ]
}
```

#### `electron-builder.yml`
Update build configuration:
```yaml
appId: 'com.yourserver.metin2launcher'     // Unique app ID
productName: 'YourServerName Launcher'      // Launcher name
copyright: 'Copyright © 2025 YourName'      // Your copyright
```

### 🔧 Step 2: Patcher Configuration

#### `app/assets/js/ascendpatcher.js`
**CRITICAL:** Update these URLs at the top of the file:
```javascript
// URL to your manifest.json file
const MANIFEST_URL = 'https://yoursite.com/game/manifest.json'

// Base URL where game files are hosted
const FILES_BASE_URL = 'https://yoursite.com/game/files/'

// Game folder name (created in Documents folder)
const GAME_FOLDER_NAME = 'YourServerName'
```

### 📱 Step 3: UI Customization

#### `app/assets/js/scripts/landing.js`
Update configuration at the top:
```javascript
const GAME_FOLDER_NAME = 'YourServerName'
const RSS_FEED_URL = 'https://yoursite.com/news.rss'
const API_URL = 'https://yoursite.com/launcher-api.php'
const API_KEY = 'your_secure_api_key'
```

#### `app/assets/js/scripts/settings.js`
Update at the top:
```javascript
const GAME_FOLDER_NAME = 'YourServerName'
```

#### `app/assets/lang/_custom.toml`
Customize branding text:
```toml
[ejs.app]
title = "YourServerName Launcher"

[ejs.landing]
mediaGitHubURL = "https://yoursite.com"
mediaDiscordURL = "https://discord.gg/yourdiscord"

[ejs.settings]
sourceGithubLink = "https://github.com/yourusername/metin2-patcher-electron"
supportLink = "https://yoursite.com/support"
```

### 🎨 Step 4: Branding & Assets

Replace these image files with your own:
- `app/assets/images/SealCircle.png` - Main logo (square, 512x512px recommended)
- `app/assets/images/SealCircle.ico` - Windows icon
- `app/assets/images/minecraft.icns` - macOS icon
- `build/icon.png` - Build icon (1024x1024px)
- `app/assets/images/backgrounds/` - Background images
- `app/assets/images/LoadingSeal.png` - Loading screen logo
- `app/assets/images/LoadingText.png` - Loading screen text

### ✅ Step 5: Verification Checklist

Before building, search your entire project for these placeholders and replace them:

- [ ] `YourServerName` - Your server name
- [ ] `yoursite.com` - Your website domain
- [ ] `yourusername` - Your GitHub username
- [ ] `YOUR_DISCORD_CLIENT_ID` - Your Discord app client ID
- [ ] `your_secure_api_key` - Your API authentication key
- [ ] All placeholder images replaced
- [ ] Tested with `npm start`
- [ ] Verified patcher downloads from your server
- [ ] Confirmed news feed loads correctly

---

## How It Works

### File Verification System

The launcher uses a sophisticated patcher system that ensures game integrity:

1. **Downloads Manifest**: Fetches `manifest.json` from your server containing all game files and their MD5 hashes
2. **Verifies Local Files**: Compares local files against the manifest to detect missing or corrupted files
3. **Downloads Updates**: Only downloads files that are missing or have mismatched hashes
4. **Hash Verification**: Re-verifies downloaded files to ensure integrity
5. **Version Tracking**: Maintains a `version.txt` file to skip verification when already up-to-date

### Game Directory Structure

Game files are stored in: `Documents/{GAME_FOLDER_NAME}/`

This directory contains:
- All game client files
- `channel.inf` - Server channel configuration (auto-generated with default: `1 99 0`)
- `version.txt` - Current game version for smart update detection

### Patcher Flow Diagram

```
[Player Clicks "Play"]
         ↓
[Check Manifest Cache]
         ↓ (Cache Invalid)
[Download manifest.json]
         ↓
[Check version.txt]
         ↓
[Version Match?] → YES → [Launch Game Immediately]
         ↓ NO
[Verify All Files (MD5)]
         ↓
[Missing/Corrupt Files?] → NO → [Update version.txt] → [Launch Game]
         ↓ YES
[Download Missing Files]
         ↓
[Verify Downloaded Files]
         ↓
[Update version.txt]
         ↓
[Launch Game]
```

---

## For Players

### Installation

1. Download the launcher installer from your server's website
2. Run the installer (Windows might show a warning - click "More info" → "Run anyway")
3. Launch the application
4. First launch will verify/download all game files (may take 5-30 minutes depending on internet speed)
5. Click "Play" to start the game!

### Troubleshooting

#### Console Access

Open the developer console for debugging:
- **Windows/Linux**: `Ctrl + Shift + I`
- **macOS**: `Cmd + Option + I`

**Export Console Logs**: Right-click in the console → "Save as..."

#### Force Refresh Manifest

If files aren't updating properly:
1. Open console (see above)
2. Type: `globalPatcher.forceRefreshManifest()` and press Enter
3. Click "Play" again

#### Clear All Game Files

To completely reset and redownload everything:
1. Close the launcher
2. Delete the folder: `Documents/{YourServerGameFolderName}`
3. Restart the launcher

#### Common Issues

**Launcher won't start**
- Make sure you have administrator privileges (Windows)
- Check that your antivirus isn't blocking the launcher
- Disable Windows Defender SmartScreen temporarily if needed

**Downloads are slow**
- The launcher limits download speed to 20 MB/s by default (configurable by server owner)
- Check your internet connection
- Try restarting your router

**Files keep re-downloading**
- This may indicate file corruption during download
- Try deleting specific files and letting the launcher re-download them
- Check if your antivirus is quarantining game files

**Game won't launch after clicking Play**
- Check console for error messages
- Verify that `metin2.exe` (or your game executable) exists in the game folder
- Make sure no antivirus is blocking the game executable

---

## For Developers

### Requirements

- **Node.js** v20.x ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- Basic knowledge of JavaScript and Electron

### Development Setup

```bash
# Clone the repository
git clone https://github.com/CeerdaN/metin2-patcher-electron.git
cd metin2-patcher-electron

# Install dependencies
npm install

# Run in development mode
npm start

# Lint code
npm run lint
```

### Project Structure

```
metin2-patcher-electron/
├── app/                                    # Application frontend
│   ├── assets/
│   │   ├── css/launcher.css               # Main stylesheet
│   │   ├── fonts/                         # Custom fonts
│   │   ├── images/                        # Images and icons
│   │   │   ├── backgrounds/               # Background images
│   │   │   └── icons/                     # UI icons
│   │   ├── js/
│   │   │   ├── ascendpatcher.js          # ⭐ Core patcher logic
│   │   │   ├── configmanager.js           # Configuration management
│   │   │   ├── discordwrapper.js          # Discord RPC integration
│   │   │   ├── distromanager.js           # Distribution config manager
│   │   │   ├── processbuilder.js          # Game process launcher
│   │   │   └── scripts/
│   │   │       ├── landing.js             # ⭐ Main UI logic
│   │   │       ├── settings.js            # Settings page logic
│   │   │       └── uibinder.js            # UI bindings
│   │   └── lang/                          # Localization files
│   │       ├── en_US.toml                 # English translations
│   │       └── _custom.toml               # ⭐ Custom branding strings
│   ├── app.ejs                            # Main app container
│   ├── landing.ejs                        # ⭐ Main launcher view
│   ├── login.ejs                          # Login view
│   ├── settings.ejs                       # Settings view
│   └── game-config.ejs                    # Game configuration view
├── distribution.json                       # ⭐ Server configuration
├── electron-builder.yml                    # ⭐ Build configuration
├── index.js                                # Main Electron process
├── package.json                            # ⭐ Project metadata & dependencies
└── README.md                               # This file

⭐ = Files you MUST customize for your server
```

### Key Files Explained

**`app/assets/js/ascendpatcher.js`**
- Core file verification and download logic
- MD5 hash calculation and verification
- Manifest fetching and caching (5-minute cache)
- Download speed throttling
- Progress tracking and callbacks

**`app/assets/js/scripts/landing.js`**
- Main UI logic and event handlers
- Launch button functionality
- Progress bar updates
- Version checking system
- News feed integration

**`distribution.json`**
- Server configuration (name, address, icon)
- Discord Rich Presence settings
- RSS feed URL
- Server modules (if any)

**`index.js`**
- Main Electron process
- Window creation and management
- Auto-updater integration
- IPC communication setup

**`package.json`**
- Project metadata
- Dependencies list
- Build scripts
- Electron-builder configuration

### Visual Studio Code Setup

For the best development experience, create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "program": "${workspaceFolder}/node_modules/electron/cli.js",
      "args": ["."],
      "outputCapture": "std"
    },
    {
      "name": "Debug Renderer Process",
      "type": "chrome",
      "request": "launch",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "runtimeArgs": [
        "${workspaceFolder}/.",
        "--remote-debugging-port=9222"
      ],
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

- **Debug Main Process**: Debug Electron's main process (backend)
- **Debug Renderer Process**: Debug Electron's renderer (UI/frontend) - requires [Debugger for Chrome](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome)

**Note**: You cannot open DevTools while using the Renderer Process debugger (only one debugger at a time).

---

## Server Setup Requirements

To use this launcher, you need to host three things on your web server:

### 📦 Included Example Files

This repository includes complete working examples to get you started:

- **`example_launcher_api.php`** - Complete authentication API (ready for XAMPP)
- **`database_schema.sql`** - MySQL database structure with sample data
- **`test_api.html`** - Beautiful web interface to test your API
- **`API_SETUP_GUIDE.md`** - Step-by-step setup instructions

**Quick Start with Example API:**
1. Install XAMPP
2. Import `database_schema.sql` into MySQL
3. Copy `example_launcher_api.php` to `htdocs/`
4. Open `test_api.html` in your browser to test!

See [API_SETUP_GUIDE.md](API_SETUP_GUIDE.md) for detailed instructions.

---

### 1. Manifest File (`manifest.json`)

**URL**: `https://yoursite.com/game/manifest.json`

**Format**:
```json
{
  "version": "1.0.0",
  "files": [
    {
      "path": "metin2.exe",
      "hash": "5d41402abc4b2a76b9719d911017c592",
      "size": 12345678
    },
    {
      "path": "pack/item_proto",
      "hash": "098f6bcd4621d373cade4e832627b4f6",
      "size": 98765
    },
    {
      "path": "data/locale/en/ui.txt",
      "hash": "5d41402abc4b2a76b9719d911017c592",
      "size": 4567
    }
  ]
}
```

**Fields**:
- `version`: Version number (e.g., "1.0.0", "2.5.3")
- `files`: Array of all game files
  - `path`: Relative path from game directory
  - `hash`: MD5 hash of the file
  - `size`: File size in bytes (optional, for UI display)

### 2. Game Files Hosting

**URL Pattern**: `https://yoursite.com/game/files/{file.path}`

Example:
- File path in manifest: `"pack/item_proto"`
- Download URL: `https://yoursite.com/game/files/pack/item_proto`

**Requirements**:
- HTTPS recommended (HTTP works but less secure)
- Files must be accessible without authentication
- Server must support range requests for resume capability (optional but recommended)
- CORS headers not required (Electron bypasses CORS)

### 3. Generating the Manifest

You can generate `manifest.json` using this Node.js script:

```javascript
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function calculateMD5(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function scanDirectory(dir, baseDir = dir) {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
            files.push(...scanDirectory(fullPath, baseDir));
        } else {
            const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            const stats = fs.statSync(fullPath);

            files.push({
                path: relativePath,
                hash: calculateMD5(fullPath),
                size: stats.size
            });
        }
    }

    return files;
}

// Usage
const gameDirectory = './game_files';  // Path to your game files
const manifest = {
    version: '1.0.0',
    files: scanDirectory(gameDirectory)
};

fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
console.log(`Generated manifest with ${manifest.files.length} files`);
```

### 4. Discord Rich Presence Setup (Optional)

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it
3. Go to "Rich Presence" → "Art Assets"
4. Upload your images:
   - `your-logo-key` (small image)
   - `your-server-logo` (large image)
5. Copy your "Application ID" (Client ID)
6. Update `distribution.json` with your Client ID and image keys

---

## Building & Distribution

### Build for All Platforms

```bash
# Build for current platform
npm run dist

# Build for specific platforms
npm run dist:win      # Windows (x64)
npm run dist:mac      # macOS (x64 + arm64)
npm run dist:linux    # Linux (x64 AppImage)
```

**Output files**:
- Windows: `dist/YourServerName-setup-1.0.0.exe`
- macOS (Intel): `dist/YourServerName-setup-1.0.0-x64.dmg`
- macOS (Apple Silicon): `dist/YourServerName-setup-1.0.0-arm64.dmg`
- Linux: `dist/YourServerName-setup-1.0.0.AppImage`

### Platform Requirements

- **Windows builds**: Can be built on Windows, macOS, or Linux
- **macOS builds**: **Must** be built on macOS (requires Xcode)
- **Linux builds**: Can be built on Linux or macOS

### Code Signing (Recommended)

To avoid Windows SmartScreen warnings:

1. Purchase a code signing certificate
2. Configure `electron-builder.yml`:
```yaml
win:
  certificateFile: "./path/to/cert.pfx"
  certificatePassword: "${env.CERT_PASSWORD}"
```

### Auto-Update Setup

The launcher includes auto-update functionality via `electron-updater`.

**Requirements**:
1. Host update files on your server
2. Create `dev-app-update.yml` or `app-update.yml`:
```yaml
provider: generic
url: https://yoursite.com/launcher-updates/
```

3. After building, upload these files to your server:
   - Latest installer (`.exe`, `.dmg`, `.AppImage`)
   - `latest.yml` (Windows) or `latest-mac.yml` (macOS)
   - `latest-linux.yml` (Linux)

---

## Technical Architecture

### Dependencies

**Core Framework**
- `electron` (v33.x) - Desktop application framework
- `@electron/remote` - Main/renderer process communication
- `electron-updater` - Automatic launcher updates

**Game Management**
- `helios-core` (~2.2.4) - Asset management and distribution handling
- `helios-distribution-types` - Type definitions for distribution

**Utilities**
- `adm-zip` - Archive extraction
- `fs-extra` - Enhanced file system operations
- `got` - HTTP requests
- `semver` - Version comparison
- `toml` - Configuration file parsing

**UI**
- `ejs` - Templating engine for dynamic HTML
- `ejs-electron` - EJS integration for Electron
- `jquery` - DOM manipulation

**Integration**
- `discord-rpc-patch` - Discord Rich Presence support

### Security Features

**Hash Verification**
- All files verified using MD5 hashing
- Prevents corrupted or tampered files
- Automatic redownload if hash doesn't match

**Download Safety**
- HTTPS support for secure downloads
- Files verified before being marked as complete
- Automatic retry on failure

**Privacy**
- No personal information collected or transmitted
- Discord RPC only shares game activity (if enabled)
- No analytics or tracking

### Performance Optimizations

**Manifest Caching**
- 5-minute cache for manifest.json
- Reduces server load
- Improves launcher startup time

**Smart Version Checking**
- `version.txt` file prevents unnecessary file verification
- Only verify files when version changes
- Dramatically faster for up-to-date clients

**Download Speed Limiting**
- Configurable bandwidth throttling (default 20 MB/s)
- Prevents overwhelming player's network
- Ensures smooth browsing while downloading

**Async File Operations**
- All file I/O is asynchronous
- Non-blocking UI during downloads
- Smooth progress updates

---

## Credits

### Original Base

This launcher is built upon [Helios Launcher](https://github.com/dscalzi/HeliosLauncher) by dscalzi, originally created for Minecraft servers. It has been extensively modified and adapted for Metin2 private server use.

### Modifications for Metin2

- Complete rewrite of patcher system for Metin2 file structure
- Custom manifest-based file verification
- MD5 hash verification system
- Channel.inf auto-generation
- Metin2-specific UI adaptations
- Removed Minecraft/Mojang authentication
- Custom authentication system support

### Third-Party Libraries

See `package.json` for a complete list of dependencies and their licenses.

---

## License

This project is provided as-is for the Metin2 private server community. You are free to:
- ✅ Use this launcher for your own Metin2 private server
- ✅ Modify and customize it to fit your needs
- ✅ Distribute it to your players
- ✅ Fork and improve it

**We kindly ask that you:**
- 🙏 Give credit to the original authors
- 🙏 Link back to this repository
- 🙏 Share improvements with the community

**Note**: This launcher is not affiliated with or endorsed by:
- Ymir Entertainment (Metin2 developers)
- Gameforge (Metin2 publisher)
- Webzen (original Metin2 publisher)
- Any official Metin2 entities

---

## Support & Community

### Documentation

- **This README**: Complete guide for setup and customization
- **Code Comments**: All critical files are well-commented
- **Example Configs**: Sample configurations provided

### Getting Help

If you're using this launcher for your server:

1. **Check this README** - Most questions are answered here
2. **Read the code comments** - Key files have detailed explanations
3. **Search existing issues** - Someone may have had the same problem
4. **Create an issue** - Describe your problem clearly with:
   - What you're trying to do
   - What's happening instead
   - Error messages (if any)
   - Your configuration (without sensitive data)

### Contributing

Contributions are welcome! If you've:
- Fixed a bug
- Added a feature
- Improved documentation
- Optimized performance

Please submit a pull request! Make sure to:
1. Test your changes thoroughly
2. Comment your code
3. Update documentation if needed
4. Follow the existing code style

---

## Changelog

### Version 1.0.0 (Current)
- Initial generic template release
- Complete Metin2 patcher system
- MD5 file verification
- Manifest caching
- Discord Rich Presence
- Auto-updater integration
- Cross-platform support (Windows, macOS, Linux)
- Full customization support

---

<p align="center">
  <strong>Ready to launch your Metin2 server with style?</strong>
</p>

<p align="center">
  <strong>Star this repo if it helped you!</strong> ⭐
</p>

<p align="center">
  Made with ❤️ for the Metin2 private server community
</p>

<p align="center">
  <em>Based on Helios Launcher | Modified for Metin2</em>
</p>
