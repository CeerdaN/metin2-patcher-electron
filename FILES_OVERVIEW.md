# Files Overview - Metin2 Launcher Template

This document provides a complete overview of all files in the launcher template and what you need to customize.

## 📋 Table of Contents

- [Files You MUST Customize](#files-you-must-customize)
- [Files You Should Replace](#files-you-should-replace)
- [Files You Can Customize (Optional)](#files-you-can-customize-optional)
- [Files You Should NOT Modify](#files-you-should-not-modify)
- [Example/Documentation Files](#exampledocumentation-files)

---

## Files You MUST Customize

These files contain placeholders that **must** be updated for your server:

### ⭐ `package.json`
**What:** Project metadata and build configuration
**Update:**
- `name` - Change to your launcher name
- `productName` - Your launcher display name
- `author` - Your name or team
- `homepage` - Your website URL
- `bugs.url` - Your support page
- `repository.url` - Your GitHub repository

**Example:**
```json
"name": "myserver-launcher",
"productName": "MyServer Launcher",
"author": "MyTeam"
```

---

### ⭐ `distribution.json`
**What:** Server configuration for the launcher
**Update:**
- `discord.clientId` - Your Discord app client ID
- `discord.smallImageText` - Your server name
- `discord.smallImageKey` - Your Discord image key
- `rss` - Your news RSS feed URL
- `servers[0].id` - Unique server identifier
- `servers[0].name` - Your server name
- `servers[0].description` - Server description
- `servers[0].icon` - Server icon URL
- `servers[0].address` - Server IP/domain
- `servers[0].discord.*` - Discord RPC settings

**Example:**
```json
{
  "discord": {
    "clientId": "1234567890123456789",
    "smallImageText": "MyServer",
    "smallImageKey": "myserver-logo"
  },
  "rss": "https://myserver.com/news.rss",
  "servers": [{
    "name": "MyServer",
    "address": "play.myserver.com"
  }]
}
```

---

### ⭐ `electron-builder.yml`
**What:** Build configuration for creating installers
**Update:**
- `appId` - Unique application ID
- `productName` - Product name
- `copyright` - Copyright notice
- `linux.maintainer` - Your name
- `linux.vendor` - Your name/organization

**Example:**
```yaml
appId: 'com.myserver.launcher'
productName: 'MyServer Launcher'
copyright: 'Copyright © 2025 MyTeam'
```

---

### ⭐ `app/assets/js/ascendpatcher.js`
**What:** Core patcher and file verification logic
**Update (Lines 16-28):**
```javascript
const MANIFEST_URL = 'https://myserver.com/game/manifest.json'
const FILES_BASE_URL = 'https://myserver.com/game/files/'
const GAME_FOLDER_NAME = 'MyServerName'
```

**Critical:** These URLs must point to your actual file hosting!

---

### ⭐ `app/assets/js/scripts/landing.js`
**What:** Main launcher UI logic
**Update (Lines 5-13):**
```javascript
const GAME_FOLDER_NAME = 'MyServerName'
const RSS_FEED_URL = 'https://myserver.com/news.rss'
const API_URL = 'https://myserver.com/launcher-api.php'
const API_KEY = 'your_random_secure_key_here'
```

---

### ⭐ `app/assets/js/scripts/settings.js`
**What:** Settings page logic
**Update (Lines 1-6):**
```javascript
const GAME_FOLDER_NAME = 'MyServerName'
```

---

### ⭐ `app/assets/lang/_custom.toml`
**What:** Custom branding and text
**Update:**
- `[ejs.app]` section - Launcher title
- `[ejs.landing]` section - All social media URLs
- `[ejs.settings]` section - GitHub and support links
- `[ejs.welcome]` section - Welcome message

**Example:**
```toml
[ejs.app]
title = "MyServer Launcher"

[ejs.landing]
mediaGitHubURL = "https://myserver.com"
mediaDiscordURL = "https://discord.gg/myserver"
```

---

## Files You Should Replace

Replace these image files with your own branding:

### 🎨 Images to Replace

**Logo/Icon Files:**
- `app/assets/images/SealCircle.png` (512x512px recommended)
- `app/assets/images/SealCircle.ico` (Windows icon)
- `app/assets/images/minecraft.icns` (macOS icon - rename to your app name)
- `build/icon.png` (1024x1024px for builds)

**Loading Screen:**
- `app/assets/images/LoadingSeal.png` (Loading logo)
- `app/assets/images/LoadingText.png` (Loading text)

**Backgrounds:**
- `app/assets/images/backgrounds/0.jpg` (Main background)
- `app/assets/images/backgrounds/1.jpg` (Alt background)

**Tools:**
- Use PNG for transparency
- Keep sizes reasonable (< 1MB each)
- Use high quality images for better appearance

---

## Files You Can Customize (Optional)

These files can be customized but have working defaults:

### `app/assets/css/launcher.css`
**What:** Stylesheet for the entire launcher
**Customize:** Colors, fonts, layouts, animations
**Note:** Advanced CSS knowledge recommended

### `app/landing.ejs`
**What:** Main launcher interface HTML
**Customize:** Layout, structure, UI elements
**Already updated:** Server name placeholders

### `app/login.ejs`
**What:** Login page HTML
**Customize:** Login form layout and styling
**Already updated:** Generic placeholders

### `app/settings.ejs`
**What:** Settings page HTML
**Customize:** Settings options and layout
**Already updated:** Generic about section

### `app/game-config.ejs`
**What:** Game configuration page
**Customize:** Configuration options available to users

---

## Files You Should NOT Modify

These files contain core launcher logic and should not be changed unless you know what you're doing:

### Core Logic Files
- `index.js` - Main Electron process
- `app/assets/js/preloader.js` - Pre-loading logic
- `app/assets/js/processbuilder.js` - Game launch process
- `app/assets/js/distromanager.js` - Distribution management
- `app/assets/js/configmanager.js` - Configuration management
- `app/assets/js/discordwrapper.js` - Discord RPC integration
- `app/assets/js/ipcconstants.js` - IPC communication constants

### UI Binding Files
- `app/assets/js/scripts/uibinder.js` - UI event bindings
- `app/assets/js/scripts/uicore.js` - Core UI functions

### Build Files
- `.eslintrc.json` - ESLint configuration
- `.eslintignore` - ESLint ignore patterns
- `.gitignore` - Git ignore patterns
- `.nvmrc` - Node version specification

---

## Example/Documentation Files

These files are for your reference and setup:

### 📚 API Example Files (Metin2 Compatible)

**`example_launcher_api.php`**
- Complete working PHP authentication API **designed for Metin2**
- Uses Metin2's existing `account` database and table
- Uses MySQL PASSWORD() function (Metin2's native password format)
- Includes login, registration (optional), account info endpoints
- Features rate limiting and security
- Compatible with MySQL 5.7/MariaDB 10.1 or lower

**`database_schema.sql`**
- MySQL schema for launcher-specific tables
- **DOES NOT create new account table** - uses Metin2's existing one
- Adds: login_attempts, launcher_sessions tables
- Includes optional test account with PASSWORD() hashing
- Has automatic cleanup procedures
- Safe to import into existing Metin2 `account` database

**`test_api.html`**
- Beautiful web interface to test your API
- No command line needed
- Tests login, registration, account info
- Real-time response display
- Works with Metin2 account structure

**`API_SETUP_GUIDE.md`**
- Step-by-step XAMPP setup instructions for Metin2
- Explains Metin2's PASSWORD() function format
- MySQL version compatibility guide
- Troubleshooting section (including PASSWORD() function issues)
- Security best practices
- Advanced configuration examples

---

## Quick Customization Checklist

Use this checklist when setting up:

### Step 1: Basic Info
- [ ] Update `package.json` metadata
- [ ] Update `distribution.json` server config
- [ ] Update `electron-builder.yml` build config

### Step 2: Patcher Configuration
- [ ] Set URLs in `app/assets/js/ascendpatcher.js`
- [ ] Set game folder name (must match across all files!)
- [ ] Host your manifest.json on your server
- [ ] Host your game files on your server

### Step 3: UI Configuration
- [ ] Update `app/assets/js/scripts/landing.js` config
- [ ] Update `app/assets/js/scripts/settings.js` config
- [ ] Update `app/assets/lang/_custom.toml` branding

### Step 4: Branding
- [ ] Replace all image files with your branding
- [ ] Update colors in CSS (optional)
- [ ] Update fonts (optional)

### Step 5: Testing
- [ ] Test with `npm start`
- [ ] Verify patcher downloads files correctly
- [ ] Test login/registration if using API
- [ ] Check news feed loads
- [ ] Verify Discord RPC works

### Step 6: Build
- [ ] Build installers with `npm run dist`
- [ ] Test installer on clean system
- [ ] Distribute to players!

---

## Configuration Values to Match

**CRITICAL:** These values must match across multiple files:

### Game Folder Name
Must be identical in:
- `app/assets/js/ascendpatcher.js` → `GAME_FOLDER_NAME`
- `app/assets/js/scripts/landing.js` → `GAME_FOLDER_NAME`
- `app/assets/js/scripts/settings.js` → `GAME_FOLDER_NAME`

Example: If you set `GAME_FOLDER_NAME = 'MyServer'`, the game will be installed to `Documents/MyServer/`

### API Key
Must be identical in:
- `app/assets/js/scripts/landing.js` → `API_KEY`
- `example_launcher_api.php` → `API_KEY` constant

### Discord Client ID
Should match in:
- `distribution.json` → `discord.clientId`
- Discord Developer Portal application

---

## File Size Reference

Expected file sizes for a standard installation:

- **Configuration files**: < 10 KB each
- **JavaScript files**: 10-500 KB each
- **Images**: 100 KB - 2 MB each
- **Fonts**: 50-200 KB each
- **Total project**: ~50-100 MB (without node_modules)
- **With node_modules**: ~300-500 MB
- **Built installer**: 80-150 MB (varies by platform)

---

## Need Help?

- **Can't find a file?** Use your IDE's search feature
- **Breaking changes?** Test with `npm start` before building
- **Still stuck?** Check the main README.md or API_SETUP_GUIDE.md
- **Found a bug?** Create an issue on GitHub

---

## Summary

**Minimum Required Changes:**
1. Update 3 main config files (package.json, distribution.json, electron-builder.yml)
2. Update 3 JavaScript files with your URLs and folder name
3. Replace ~8 image files with your branding
4. Update 1 language file for custom text

**That's it!** Everything else has sensible defaults and will work out of the box.

---

Good luck with your Metin2 server launcher! 🚀
