interface Participant {
  id: string;
  name: string;
  seed: number | null;
  ffaScore: number | null;
  ffaNote: string | null;
  status: string;
}

interface Props {
  participants: Participant[];
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER' | null;
  champion?: string | null;
}

export function FfaStandingsTable({ participants, direction, champion }: Props) {
  const reported = participants.filter((p) => p.ffaScore !== null);
  const noScore = participants.filter((p) => p.ffaScore === null);

  const ranked = [...reported].sort((a, b) => {
    const sa = Number(a.ffaScore);
    const sb = Number(b.ffaScore);
    return direction === 'LOWER_BETTER' ? sa - sb : sb - sa;
  });

  return (
    <div className="overflow-x-auto border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="px-3 py-2 text-left tag-tactical">#</th>
            <th className="px-3 py-2 text-left tag-tactical">Operador</th>
            <th className="px-3 py-2 text-right tag-tactical">Score</th>
            <th className="px-3 py-2 text-left tag-tactical">Nota</th>
          </tr>
        </thead>
        <tbody>
          {ranked.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                Sin scores reportados aún. Usá <code>/score submit</code>.
              </td>
            </tr>
          ) : (
            ranked.map((p, i) => {
              const isChampion = champion === p.id || (i === 0 && champion);
              return (
                <tr
                  key={p.id}
                  className={`border-b border-border last:border-b-0 ${
                    isChampion ? 'bg-primary/10' : ''
                  }`}
                >
                  <td className="px-3 py-2 display tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2 font-bold">{p.name}</td>
                  <td className="display px-3 py-2 text-right text-xl tabular-nums text-primary">
                    {Number(p.ffaScore)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {p.ffaNote ?? '—'}
                  </td>
                </tr>
              );
            })
          )}
          {noScore.length > 0 && (
            <>
              <tr>
                <td colSpan={4} className="border-t border-border bg-muted px-3 py-1 tag-tactical">
                  Sin reportar ({noScore.length})
                </td>
              </tr>
              {noScore.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0 opacity-50">
                  <td className="px-3 py-2 text-muted-foreground">—</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                  <td className="px-3 py-2"></td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
      <div className="border-t border-border bg-muted px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        {direction === 'LOWER_BETTER' ? 'Menor puntaje = mejor' : 'Mayor puntaje = mejor'}
      </div>
    </div>
  );
}
