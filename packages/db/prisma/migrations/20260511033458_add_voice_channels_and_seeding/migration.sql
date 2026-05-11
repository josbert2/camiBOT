-- CreateEnum
CREATE TYPE "SeedingMode" AS ENUM ('RANDOM', 'REGISTRATION', 'MANUAL');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "voiceChannelId" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "seedingMode" "SeedingMode" NOT NULL DEFAULT 'RANDOM',
ADD COLUMN     "voiceCategoryId" TEXT;
