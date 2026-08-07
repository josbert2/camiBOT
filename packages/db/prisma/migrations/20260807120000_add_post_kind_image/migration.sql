-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('VIDEO', 'PHOTO', 'TEXT');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "kind" "PostKind" NOT NULL DEFAULT 'VIDEO';
ALTER TABLE "Post" ADD COLUMN "imageKey" TEXT;
ALTER TABLE "Post" ALTER COLUMN "videoKey" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Post_kind_status_createdAt_idx" ON "Post"("kind", "status", "createdAt");
