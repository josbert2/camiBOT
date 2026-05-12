-- CreateEnum
CREATE TYPE "FfaDirection" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TournamentFormat" ADD VALUE 'FFA';
ALTER TYPE "TournamentFormat" ADD VALUE 'GROUP_STAGE';

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "ffaNote" TEXT,
ADD COLUMN     "ffaScore" DECIMAL(12,3),
ADD COLUMN     "groupNumber" INTEGER;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "advancePerGroup" INTEGER,
ADD COLUMN     "ffaDirection" "FfaDirection",
ADD COLUMN     "groupCount" INTEGER;
