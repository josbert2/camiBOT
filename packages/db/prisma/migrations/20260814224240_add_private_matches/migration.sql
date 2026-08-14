-- CreateEnum
CREATE TYPE "PrivateMatchStatus" AS ENUM ('OPEN', 'CLOSED', 'FINISHED');

-- CreateTable
CREATE TABLE "PrivateMatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "link" TEXT,
    "maxPlayers" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "status" "PrivateMatchStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateMatchSignup" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateMatchSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivateMatch_status_scheduledAt_idx" ON "PrivateMatch"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "PrivateMatchSignup_matchId_idx" ON "PrivateMatchSignup"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateMatchSignup_matchId_userId_key" ON "PrivateMatchSignup"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "PrivateMatch" ADD CONSTRAINT "PrivateMatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMatchSignup" ADD CONSTRAINT "PrivateMatchSignup_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "PrivateMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMatchSignup" ADD CONSTRAINT "PrivateMatchSignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
