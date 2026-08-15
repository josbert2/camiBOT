-- DropForeignKey
ALTER TABLE "PrivateSquad" DROP CONSTRAINT "PrivateSquad_captainId_fkey";

-- DropIndex
DROP INDEX "PrivateSquad_matchId_captainId_key";

-- AlterTable
ALTER TABLE "PrivateSquad" ALTER COLUMN "captainId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PrivateSquad" ADD CONSTRAINT "PrivateSquad_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
