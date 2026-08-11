-- CreateEnum
CREATE TYPE "GulagStatus" AS ENUM ('ACCUSED', 'CONFIRMED', 'ACQUITTED');

-- CreateTable
CREATE TABLE "GulagEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT,
    "evidence" TEXT,
    "status" "GulagStatus" NOT NULL DEFAULT 'ACCUSED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GulagEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GulagEntry_status_createdAt_idx" ON "GulagEntry"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "GulagEntry" ADD CONSTRAINT "GulagEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GulagEntry" ADD CONSTRAINT "GulagEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
