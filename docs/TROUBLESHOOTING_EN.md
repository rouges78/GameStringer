# Troubleshooting Guide - GameStringer

> 🛡️ **Antivirus or SmartScreen blocking GameStringer / BepInEx / gs-hook?**
> It's a known false positive: see **[ANTIVIRUS.md](ANTIVIRUS.md)** for why it
> happens, how to verify your download, and how to report it to Microsoft.

## 🚨 Common Problems and Solutions

### 1. Error 500 - Patches Page

#### Symptoms

- "500 | Internal Server Error" when accessing `/patches`
- Console shows "Unexpected token" or JSX errors

#### Cause

The `app/patches/page.tsx` file is corrupted with:

- Overlapping text
- Unclosed JSX tags
- Invalid TypeScript syntax

#### Solution

```bash
# 1. Back up the corrupted file
cp app/patches/page.tsx app/patches/page.tsx.corrupted

# 2. Replace with a clean version
# The file has already been recreated and fixed

# 3. Restart the server
npm run dev
```

### 2. Empty Games Dropdown

#### Symptoms

- The game selector in patch creation is empty
- No games available despite them being present in the database

#### Cause

The `/api/games` API returns a data structure incompatible with the `GameInfo` interface expected by the frontend.

#### Solution

The `app/api/games/route.ts` file has been updated to map the fields correctly:

```typescript
const mappedGames = games.map(game => ({
  id: game.id,
  title: game.title,
  path: game.installPath,
  isInstalled: game.isInstalled
}));
```

### 3. TypeScript Error "Cannot find type definition file for 'long'"

#### Symptoms

- TypeScript error: "Cannot find type definition file for 'long'"
- `npx tsc --noEmit` fails with a type definition error
- The error persists even though @types/long is installed

#### Cause

Conflict between two type definitions for 'long':

- `@xtuc/long` (an indirect dependency of webpack/webassembly) already provides the definitions
- `@types/long` creates a duplicate conflict

#### Solution

```bash
# Remove @types/long, which is redundant
npm uninstall @types/long

# Verify that the error is resolved
npx tsc --noEmit
```

#### Technical Notes

- `@xtuc/long` is an indirect dependency of `@webassemblyjs`
- It provides complete definitions for the Long type
- No additional `@types/long` is needed

### 4. Prisma EPERM Errors on Windows

#### Symptoms

```text
Error: EPERM: operation not permitted, rename
'node_modules\.prisma\client\...'
```

#### Cause

Insufficient permissions to modify files in `node_modules` on Windows.

#### Solution

```bash
# Run PowerShell as Administrator
# Then run:
npx prisma generate
```

### 4. Database Not Initialized

#### Symptoms

- "Table not found" errors
- Unable to save data

#### Cause

SQLite database not created or schema not applied.

#### Solution

```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Create/update the database
npx prisma db push

# 3. (Optional) Populate with test data
npx tsx scripts/seed-translations.ts
```

### 5. Steam Authentication Not Working

#### Symptoms

- Steam login fails
- `steamLoginSecure` cookie expired

#### Cause

Invalid or expired authentication cookie.

#### Solution

1. Sign in to <https://store.steampowered.com> in your browser
2. Open DevTools (F12) → Application → Cookies
3. Copy the value of `steamLoginSecure`
4. Update `.env.local`:

```env
STEAM_LOGIN_SECURE=nuovo_valore_cookie
```

### 6. Translation Import Fails

#### Symptoms

- Error while importing a JSON/CSV/PO file
- File not recognized

#### Cause

Incorrect file format or wrong encoding.

#### Solution

Check the file format:

**Valid JSON:**

```json
[
  {
    "original": "Hello",
    "translation": "Ciao",
    "context": "greeting"
  }
]
```

**Valid CSV:**

```csv
original,translation,context
"Hello","Ciao","greeting"
```

### 7. Epic Games OAuth Infinite Loop

#### Symptoms

- Continuous redirect after Epic Games login
- Unable to complete authentication

#### Cause

Callback URL not configured correctly.

#### Solution

1. Verify in the Epic Games Developer Portal:
   - Redirect URI: `http://localhost:3000/api/auth/callback/epicgames`
2. Check `.env.local`:

```env
EPIC_CLIENT_ID=your_client_id
EPIC_CLIENT_SECRET=your_client_secret
```

### 8. Utility Services Won't Activate

#### Symptoms

- HowLongToBeat or SteamGridDB don't work
- Connection test fails

#### Cause

Missing or invalid API key.

#### Solution

For SteamGridDB:

1. Register at <https://www.steamgriddb.com>
2. Go to Profile → Preferences → API
3. Copy the API key
4. Enter it when prompted in the app

### 9. Empty Patch Export

#### Symptoms

- Downloaded ZIP file is empty
- No files in the patch

#### Cause

Patch created without any associated files.

#### Solution

1. Edit the patch
2. Add at least one file to translate
3. Save the changes
4. Retry the export

### 10. Slow Performance with Many Translations

#### Symptoms

- Slow UI with 1000+ translations
- Search takes too long

#### Cause

Lack of pagination and indexing.

#### Temporary Solution

Use filters to reduce the results:

- Filter by a specific game
- Filter by status
- Use targeted search

### 11. Unreal game: "this game exposes no extractable text"

#### Symptoms

- String it! stops on an Unreal game saying there is nothing to translate
- The game clearly has English dialogue and interface text

#### Cause

Three different causes, which the app now tells apart:

1. **The text exists but lives somewhere else.** In UE5 games the `.locres` can
   sit loose on disk, inside the IoStore container (`.utoc`/`.ucas`), or in the
   legacy `.pak` beside it. GameStringer tries all three.
2. **The archives are encrypted.** In that case the panel does not claim there
   is no text: it asks for the AES key (see below).
3. **The game has no localization at all.** Shipped in a single language, with
   the strings written straight into the code: there is no `.locres` to
   translate.

#### Solution

For the encrypted case, paste the AES-256 key into the field that appears in the
panel — base64 or hex, both accepted. GameStringer **does not recover the key
from the game**; without it, that title stays out of reach.

To check by hand what a pak contains, using the tools the app downloads into
`%APPDATA%/GameStringer/tools/`:

```bash
repak.exe list "<game>/Content/Paks/<Name>-Windows.pak" | grep locres
```text

⚠️ `retoc list` on the container is not the right check: it prints chunk IDs, not
file names, so not seeing `.locres` there is not evidence of absence.

Full detail in [`METODI-DI-TRADUZIONE.md`](METODI-DI-TRADUZIONE.md) and
[`UNREAL-DOVE-STANNO-I-LOCRES.md`](UNREAL-DOVE-STANNO-I-LOCRES.md).

## 🛠️ Useful Debug Commands

### Check Database Status

```bash
# Check if the database exists
ls prisma/

# View the schema
cat prisma/schema.prisma

# Run a test query
npx prisma studio
```

### Full Reset

```bash
# WARNING: Deletes all data!
rm prisma/dev.db
npx prisma db push
npx tsx scripts/seed-translations.ts
```

### Detailed Logs

```bash
# Enable Prisma logs
export DEBUG="prisma:*"
npm run dev
```

### Check Dependencies

```bash
# Check versions
npm list @prisma/client next react

# Update dependencies
npm update
```

## 📞 Support

If the problem persists:

1. **Check the logs**:
   - Browser console (F12)
   - Server terminal
   - Tauri logs (if desktop app)

2. **Gather information**:
   - Operating system and version
   - Node.js version (`node -v`)
   - Screenshot of the error
   - Steps to reproduce

3. **Report the problem**:
   - Open an issue on GitHub
   - Include all the information gathered
   - Use appropriate tags (bug, help wanted)

## 🔍 Advanced Debugging

### Enabling Source Maps

```json
// tsconfig.json
{
  "compilerOptions": {
    "sourceMap": true
  }
}
```

### Inspecting API Requests

```javascript
// Add in app/layout.tsx
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('fetch', (e) => {
    console.log('API Call:', e.request.url);
  });
}
```

### Checking the Auth Session

```typescript
// Test page: app/debug/page.tsx
import { getServerSession } from 'next-auth';

export default async function DebugPage() {
  const session = await getServerSession();
  return <pre>{JSON.stringify(session, null, 2)}</pre>;
}
```

---

**Last updated**: July 1, 2025
