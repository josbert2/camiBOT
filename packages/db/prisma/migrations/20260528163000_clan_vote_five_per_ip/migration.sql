-- Permitir hasta 5 votos por IP (en clanes distintos)
DROP INDEX IF EXISTS "ClanVote_ipHash_key";

CREATE UNIQUE INDEX "ClanVote_clanNameId_ipHash_key" ON "ClanVote"("clanNameId", "ipHash");

CREATE INDEX "ClanVote_ipHash_idx" ON "ClanVote"("ipHash");
