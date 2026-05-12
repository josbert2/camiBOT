import { computeStandings } from '@camibot/core';

interface Participant {
  id: string;
  name: string;
  seed: number | null;
  groupNumber: number | null;
}

interface MatchInput {
  participant1Id: string | null;
  participant2Id: string | null;
  winnerId: string | null;
  status: string;
  round: number;
}

interface Props {
  participants: Participant[];
  matches: MatchInput[];
  /** offset > 100 son playoffs; los excluimos de la fase de grupos */
  playoffOffset: number;
}

export function GroupStageTable({ participants, matches, playoffOffset }: Props) {
  // Agrupar participantes por grupo
  const groups = new Map<number, Participant[]>();
  for (const p of participants) {
    const g = p.groupNumber;
    if (g === null) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(p);
  }

  const groupMatches = matches.filter((m) => m.round < playoffOffset);

  if (groups.size === 0) {
    return (
      <div className="hud-panel p-6 text-center text-sm text-muted-foreground">
        Asignación de grupos pendiente.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[...groups.entries()].map(([gNum, members]) => {
        const ids = members.map((m) => m.id);
        const completed = groupMatches
          .filter(
            (m) =>
              m.status === 'COMPLETED' &&
              m.participant1Id &&
              m.participant2Id &&
              m.winnerId &&
              ids.includes(m.participant1Id) &&
              ids.includes(m.participant2Id),
          )
          .map((m) => ({
            participant1Id: m.participant1Id!,
            participant2Id: m.participant2Id!,
            winnerId: m.winnerId!,
          }));
        const standings = computeStandings(ids, completed);
        const byId = new Map(members.map((p) => [p.id, p]));

        return (
          <div key={gNum} className="border border-border bg-card">
            <div className="border-b border-border bg-muted px-3 py-2">
              <span className="display tracking-widest text-primary">Grupo {gNum}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-2 py-1 text-left tag-tactical">#</th>
                  <th className="px-2 py-1 text-left tag-tactical">Operador</th>
                  <th className="px-2 py-1 text-right tag-tactical">W</th>
                  <th className="px-2 py-1 text-right tag-tactical">L</th>
                  <th className="px-2 py-1 text-right tag-tactical">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => {
                  const p = byId.get(s.participantId);
                  if (!p) return null;
                  return (
                    <tr key={s.participantId} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-1 tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1 font-bold">{p.name}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-success">{s.wins}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-danger">{s.losses}</td>
                      <td className="display px-2 py-1 text-right text-lg tabular-nums text-primary">
                        {s.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
