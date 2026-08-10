-- CreateEnum
CREATE TYPE "LeagueStatus" AS ENUM ('ACTIVE', 'FINISHED');
CREATE TYPE "LeagueMatchStatus" AS ENUM ('PENDING', 'PLAYED');

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "guildId" TEXT,
    "status" "LeagueStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");
CREATE INDEX "League_status_createdAt_idx" ON "League"("status", "createdAt");

CREATE TABLE "LeaguePlayer" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "LeaguePlayer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeaguePlayer_leagueId_userId_key" ON "LeaguePlayer"("leagueId", "userId");
CREATE INDEX "LeaguePlayer_leagueId_idx" ON "LeaguePlayer"("leagueId");

CREATE TABLE "LeagueMatch" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "awayId" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "homeKills" INTEGER,
    "awayKills" INTEGER,
    "status" "LeagueMatchStatus" NOT NULL DEFAULT 'PENDING',
    "playedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueMatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeagueMatch_leagueId_homeId_awayId_key" ON "LeagueMatch"("leagueId", "homeId", "awayId");
CREATE INDEX "LeagueMatch_leagueId_status_idx" ON "LeagueMatch"("leagueId", "status");

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaguePlayer" ADD CONSTRAINT "LeaguePlayer_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaguePlayer" ADD CONSTRAINT "LeaguePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueMatch" ADD CONSTRAINT "LeagueMatch_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueMatch" ADD CONSTRAINT "LeagueMatch_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "LeaguePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueMatch" ADD CONSTRAINT "LeagueMatch_awayId_fkey" FOREIGN KEY ("awayId") REFERENCES "LeaguePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
