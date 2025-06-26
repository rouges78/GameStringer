-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "installPath" TEXT,
    "executablePath" TEXT,
    "icon" TEXT,
    "imageUrl" TEXT,
    "isInstalled" BOOLEAN NOT NULL DEFAULT false,
    "steamAppId" INTEGER,
    "isVr" BOOLEAN NOT NULL DEFAULT false,
    "engine" TEXT,
    "lastPlayed" DATETIME,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_games" ("createdAt", "executablePath", "icon", "id", "imageUrl", "installPath", "isInstalled", "platform", "steamAppId", "title", "updatedAt") SELECT "createdAt", "executablePath", "icon", "id", "imageUrl", "installPath", "isInstalled", "platform", "steamAppId", "title", "updatedAt" FROM "games";
DROP TABLE "games";
ALTER TABLE "new_games" RENAME TO "games";
CREATE UNIQUE INDEX "games_steamAppId_key" ON "games"("steamAppId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
