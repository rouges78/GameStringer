/*
  Warnings:

  - A unique constraint covering the columns `[steamAppId]` on the table `games` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "games" ADD COLUMN "steamAppId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "games_steamAppId_key" ON "games"("steamAppId");
