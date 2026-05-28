-- CreateTable
CREATE TABLE "ClanName" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanVote" (
    "id" TEXT NOT NULL,
    "clanNameId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClanVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClanName_slug_key" ON "ClanName"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ClanName_normalizedName_key" ON "ClanName"("normalizedName");

-- CreateIndex
CREATE INDEX "ClanName_ipHash_createdAt_idx" ON "ClanName"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "ClanName_createdAt_idx" ON "ClanName"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClanVote_ipHash_key" ON "ClanVote"("ipHash");

-- CreateIndex
CREATE INDEX "ClanVote_clanNameId_idx" ON "ClanVote"("clanNameId");

-- AddForeignKey
ALTER TABLE "ClanVote" ADD CONSTRAINT "ClanVote_clanNameId_fkey" FOREIGN KEY ("clanNameId") REFERENCES "ClanName"("id") ON DELETE CASCADE ON UPDATE CASCADE;
