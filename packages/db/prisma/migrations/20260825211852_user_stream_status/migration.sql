-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kickSlug" TEXT,
ADD COLUMN     "liveCheckedAt" TIMESTAMP(3),
ADD COLUMN     "livePlatform" TEXT,
ADD COLUMN     "liveStartedAt" TIMESTAMP(3),
ADD COLUMN     "liveTitle" TEXT,
ADD COLUMN     "liveUrl" TEXT,
ADD COLUMN     "liveViewers" INTEGER,
ADD COLUMN     "tiktokUser" TEXT,
ADD COLUMN     "twitchLogin" TEXT;

-- CreateIndex
CREATE INDEX "User_livePlatform_idx" ON "User"("livePlatform");
