-- CreateEnum
CREATE TYPE "VerdictVote" AS ENUM ('GUILTY', 'INNOCENT');

-- CreateTable
CREATE TABLE "Verdict" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" "VerdictVote" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Verdict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Verdict_postId_userId_key" ON "Verdict"("postId", "userId");
CREATE INDEX "Verdict_postId_idx" ON "Verdict"("postId");

-- AddForeignKey
ALTER TABLE "Verdict" ADD CONSTRAINT "Verdict_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Verdict" ADD CONSTRAINT "Verdict_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
