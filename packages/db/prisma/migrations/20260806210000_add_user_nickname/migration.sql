-- AlterTable
ALTER TABLE "User" ADD COLUMN "nickname" TEXT;
ALTER TABLE "User" ADD COLUMN "nicknameSet" BOOLEAN NOT NULL DEFAULT false;
