-- AlterTable
ALTER TABLE "PrivateMatch" ADD COLUMN     "hasSignup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prize" TEXT;
