-- AlterTable
ALTER TABLE "Post" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");
