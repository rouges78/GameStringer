# 🎮 GameStringer v1.5.0

> **Release Date**: March 24, 2026  
> **Type**: Community Chat Realtime

---

## 💬 Community Chat (v1.5.0)

- **Real-time chat** integrated into Community Hub via Supabase Realtime
- **4 default rooms**: General, Translations, Feedback & Bug, Announcements
- **Create custom rooms** for specific games or translation projects
- **Auto-bridge authentication**: GameStringer profile auto-syncs with Supabase Auth — no extra login needed
- **Online presence**: see who's online in real-time
- **Message actions**: send, reply, edit, delete messages
- **Chat widget**: expandable drawer in bottom-right corner

## 🔗 Auto-Bridge Authentication

- **Zero-config login**: your GS profile is automatically bridged to Supabase
- **Unified Supabase client**: eliminated "Multiple GoTrueClient" warnings
- **Auto-profile creation**: database trigger creates user profile on sign-up

## 🌍 i18n & Documentation

- **Chat translations** in all 11 supported languages (IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL)
- **User guides** updated in 11 languages with Community Chat section
- **Interactive tutorial** for Community Chat added
- **Locales** common.json updated with chat section

## 🗄️ Supabase Backend

- **PostgreSQL**: chat_rooms, chat_messages, chat_room_members, user_presence tables
- **RLS Policies**: row-level security for all chat data
- **RPC Functions**: ensure_user_profile, update_presence (SECURITY DEFINER)
- **Trigger**: auto-create user profile on auth sign-up
- **Realtime**: message and presence broadcasting via Supabase Realtime

## 📜 License v1.1

- **Source Available License** updated
- **Non-commercial clarified**: YouTuber/streamer OK with attribution
- **Forks allowed**: Non-commercial forks explicitly permitted

---

## 🔧 Bug Fixes (v1.0.8)

- **Download button**: Now opens browser correctly
- **Tauri Shell API**: Used instead of window.open for external links
- **Toast feedback**: Visual confirmation for download opening

---

## 📥 Downloads

| File | Description |
|------|-------------|
| `GameStringer-1.5.0-Setup.exe` | Windows Installer (recommended) |
| `GameStringer-1.5.0-Portable.zip` | Portable version (no install) |
| `checksums-sha256.txt` | SHA256 checksums for verification |

### System Requirements

- Windows 10/11 (64-bit)
- 4GB RAM (8GB+ recommended for local AI)
- 500MB disk space

---

## 🔧 Installation

### Setup (Recommended)

1. Download `GameStringer-1.5.0-Setup.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch GameStringer from Start Menu

### Portable

1. Download `GameStringer-1.5.0-Portable.zip`
2. Extract to any folder
3. Run `GameStringer.exe`

---

## 📖 Documentation

User guides available in 11 languages:

| Language | Guide |
|----------|-------|
| 🇮🇹 Italian | [GUIDA_UTENTE.md](docs/GUIDA_UTENTE.md) |
| 🇬🇧 English | [USER_GUIDE_EN.md](docs/USER_GUIDE_EN.md) |
| 🇪🇸 Spanish | [USER_GUIDE_ES.md](docs/USER_GUIDE_ES.md) |
| 🇫🇷 French | [USER_GUIDE_FR.md](docs/USER_GUIDE_FR.md) |
| 🇩🇪 German | [USER_GUIDE_DE.md](docs/USER_GUIDE_DE.md) |
| 🇯🇵 Japanese | [USER_GUIDE_JA.md](docs/USER_GUIDE_JA.md) |
| 🇨🇳 Chinese | [USER_GUIDE_ZH.md](docs/USER_GUIDE_ZH.md) |
| 🇰🇷 Korean | [USER_GUIDE_KO.md](docs/USER_GUIDE_KO.md) |
| 🇧🇷 Portuguese | [USER_GUIDE_PT.md](docs/USER_GUIDE_PT.md) |
| 🇷🇺 Russian | [USER_GUIDE_RU.md](docs/USER_GUIDE_RU.md) |
| 🇵🇱 Polish | [USER_GUIDE_PL.md](docs/USER_GUIDE_PL.md) |

---

## 🆕 What's New Since v1.0.6

| Feature | Description |
|---------|-------------|
| ✨ Animated headers | Breathing gradient effect on 16 pages |
| 💬 Community Hub | GitHub Discussions integration |
| � Update notifications | Smart alerts with sound |
| 📜 License v1.1 | Clarified non-commercial use |
| 📖 User guides | 7 languages documentation |

---

## 💖 Support

If GameStringer helped you enjoy games in your language:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Me-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/gamestringer)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-Sponsor-EA4AAA?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/rouges78)

---

**Full Changelog**: <https://github.com/rouges78/GameStringer/compare/v1.4.2...v1.5.0>
