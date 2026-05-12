import { computeSwissStandings } from '@camibot/core';

interface Participant {
  id: string;
  name: string;
  seed: number | null;
}

interface MatchInput {
  participant1Id: string | null;
  participant2Id: string | null;
  winnerId: string | null;
  status: string;
}

interface Props {
  participants: Participant[];
  matches: MatchInput[];
  champion?: string | null;
}

/** Tabla Suiza con desempate por Buchholz. */
export function SwissStandingsTable({ participants, matches, champion }: Props) {
  const completed = matches
    .filter(
      (m) =>
        m.status === 'COMPLETED' &&
        m.participant1Id &&
        m.participant2Id &&
        m.winnerId,
    )
    .map((m) => ({
      participant1Id: m.participant1Id!,
      participant2Id: m.participant2Id!,
      winnerId: m.winnerId!,
    }));

  const standings = computeSwissStandings(
    participants.map((p) => p.id),
    completed,
  );

  const byId = new Map(participants.map((p) => [p.id, p]));

  return (
    <div className="overflow-x-auto border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="px-3 py-2 text-left tag-tactical">#</th>
            <th className="px-3 py-2 text-left tag-tactical">Operador</th>
            <th className="px-3 py-2 text-right tag-tactical">PJ</th>
            <th className="px-3 py-2 text-right tag-tactical">W</th>
            <th className="px-3 py-2 text-right tag-tactical">L</th>
            <th className="px-3 py-2 text-right tag-tactical">Buch.</th>
            <th className="px-3 py-2 text-right tag-tactical">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const participant = byId.get(s.participantId);
            if (!participant) return null;
            const isChampion = champion === s.participantId || (i === 0 && champion);
            return (
              <tr
                key={s.participantId}
                className={`border-b border-border last:border-b-0 ${
                  isChampion ? 'bg-primary/10' : ''
                }`}
              >
                <td className="px-3 py-2 display tabular-nums">{i + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-bold">{participant.name}</div>
                  {participant.seed !== null && (
                    <div className="text-[10px] uppercase text-muted-foreground">
                      seed {participant.seed}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{s.played}</td>
                <td className="px-3 py-2 text-right tabular-nums text-success">
                  {s.wins}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-danger">
                  {s.losses}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {s.buchholz}
                </td>
                <td className="display px-3 py-2 text-right text-xl tabular-nums text-primary">
                  {s.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
