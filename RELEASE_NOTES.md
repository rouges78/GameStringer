# 🎮 GameStringer v1.0.6

> **Release Date**: January 28, 2026  
> **Type**: Bug Fixing & New Translation Providers

---

## 🌐 New Translation Providers

### Qwen 3 (Asian Languages)
- **Optimized** for Chinese, Japanese, and Korean translations
- Runs locally via **Ollama** - no API key needed
- Models: `qwen3:32b`, `qwen3:14b`, `qwen3:8b`, `qwen3:4b`
- Install: `ollama pull qwen3:14b`

### NLLB-200 (Meta AI)
- **200 languages** support including rare ones:
  - Thai, Vietnamese, Hindi, Arabic, Swahili
  - Indonesian, Turkish, Ukrainian, and more
- Uses **HuggingFace Inference API** (free tier available)
- Model: `facebook/nllb-200-distilled-600M`

### Generic Ollama
- Use **any model** installed in Ollama for translation
- Automatic fallback to first available model

---

## 🐛 Bug Fixes

- **Empty catch blocks**: Replaced 8 silent catches with proper logging
- **Unused imports**: Removed ~15 unused imports from main files
- **Vitest config**: Added missing `provider: 'v8'` for coverage
- **Batch operations**: Fixed incompatible function signatures with wrapper functions

---

## 🌍 Translations

Added missing translations for **5 languages** (ES, FR, DE, JA, ZH):

- `voiceCloneGuide` + 6 features
- `vrOverlayGuide` + 6 features  
- `qualityGatesGuide` + 6 features
- `playerFeedbackGuide` + 6 features

---

## 📥 Downloads

| File | Description |
|------|-------------|
| `GameStringer-1.0.6-Setup.exe` | Windows Installer (recommended) |
| `GameStringer-1.0.6-Portable.zip` | Portable version (no install) |
| `checksums-sha256.txt` | SHA256 checksums for verification |

### System Requirements
- Windows 10/11 (64-bit)
- 4GB RAM (8GB+ recommended for local AI)
- 500MB disk space

---

## 🔧 Installation

### Setup (Recommended)
1. Download `GameStringer-1.0.6-Setup.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch GameStringer from Start Menu

### Portable
1. Download `GameStringer-1.0.6-Portable.zip`
2. Extract to any folder
3. Run `GameStringer.exe`

---

## 🆕 What's New Since v1.0.5

| Feature | Description |
|---------|-------------|
| 🌐 Qwen 3 | Asian language translation via Ollama |
| 🌍 NLLB-200 | 200 languages via HuggingFace |
| 🔧 Bug fixes | Improved stability and logging |
| 🌍 i18n | Complete translations for all UI |

---

## 💖 Support

If GameStringer helped you enjoy games in your language:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Me-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/gamestringer)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-Sponsor-EA4AAA?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/rouges78)

---

**Full Changelog**: https://github.com/rouges78/GameStringer/compare/v1.0.5...v1.0.6
