-- AlterTable
ALTER TABLE "PrivateMatch" ADD COLUMN     "squadSize" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PrivateMatchSignup" ADD COLUMN     "squadId" TEXT;

-- CreateTable
CREATE TABLE "PrivateSquad" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateSquad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivateSquad_matchId_idx" ON "PrivateSquad"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateSquad_matchId_captainId_key" ON "PrivateSquad"("matchId", "captainId");

-- CreateIndex
CREATE INDEX "PrivateMatchSignup_squadId_idx" ON "PrivateMatchSignup"("squadId");

-- AddForeignKey
ALTER TABLE "PrivateSquad" ADD CONSTRAINT "PrivateSquad_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "PrivateMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateSquad" ADD CONSTRAINT "PrivateSquad_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMatchSignup" ADD CONSTRAINT "PrivateMatchSignup_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "PrivateSquad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
