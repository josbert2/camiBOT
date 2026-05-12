import { computeStandings } from '@camibot/core';

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

/**
 * Tabla de posiciones para torneos round-robin. Calcula puntos a partir de
 * los matches COMPLETED con winnerId.
 */
export function StandingsTable({ participants, matches, champion }: Props) {
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

  const standings = computeStandings(
    participants.map((p) => p.id),
    completed,
  );

  const byId = new Map(participants.map((p) => [p.id, p]));

  return (
    <div className="overflow-x-auto border-2 border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border bg-muted text-[10px] uppercase tracking-widest text-muted-foreground">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Participante</th>
            <th className="px-3 py-2 text-right tabular-nums">PJ</th>
            <th className="px-3 py-2 text-right tabular-nums">W</th>
            <th className="px-3 py-2 text-right tabular-nums">L</th>
            <th className="px-3 py-2 text-right tabular-nums">Pts</th>
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
                <td className="px-3 py-2 font-bold tabular-nums">
                  {isChampion ? '🏆' : i + 1}
                </td>
                <td className="px-3 py-2">
                  <div className="font-bold">{participant.name}</div>
                  {participant.seed && (
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
                <td className="px-3 py-2 text-right text-lg font-bold tabular-nums">
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
