'use client';

import { useMemo } from 'react';

export interface BracketMatch {
  id: string;
  round: number;
  matchNumber: number;
  participant1Id: string | null;
  participant2Id: string | null;
  winnerId: string | null;
  scoreP1: number;
  scoreP2: number;
  status: string;
  nextMatchId: string | null;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  seed: number | null;
}

interface BracketSVGProps {
  matches: BracketMatch[];
  participants: ParticipantInfo[];
}

// Brutalist layout constants
const MATCH_W = 220;
const MATCH_H = 72;
const GAP_V = 32;
const GAP_H = 84;
const PADDING = 32;

export function BracketSVG({ matches, participants }: BracketSVGProps) {
  const nameById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );

  const { positions, viewBox } = useMemo(() => computeLayout(matches), [matches]);

  if (matches.length === 0) {
    return (
      <div className="border-2 border-border-strong bg-card p-12 text-center text-muted-foreground">
        // Bracket aún no generado
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-2 border-border-strong bg-card">
      <svg
        viewBox={viewBox}
        className="block min-w-[800px] font-mono text-foreground"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Connectors first so boxes overlap them */}
        <g>
          {matches.map((m) => {
            if (!m.nextMatchId) return null;
            const from = positions.get(m.id);
            const to = positions.get(m.nextMatchId);
            if (!from || !to) return null;
            return <Connector key={`c-${m.id}`} from={from} to={to} />;
          })}
        </g>

        {/* Match boxes */}
        <g>
          {matches.map((m) => {
            const pos = positions.get(m.id);
            if (!pos) return null;
            return (
              <MatchBox
                key={m.id}
                x={pos.x}
                y={pos.y}
                match={m}
                p1={m.participant1Id ? nameById.get(m.participant1Id) : null}
                p2={m.participant2Id ? nameById.get(m.participant2Id) : null}
              />
            );
          })}
        </g>

        {/* Round labels */}
        <g>
          {roundLabels(matches).map(({ round, x, label }) => (
            <text
              key={round}
              x={x + MATCH_W / 2}
              y={20}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="11"
              letterSpacing="3"
            >
              {label.toUpperCase()}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

function MatchBox({
  x,
  y,
  match,
  p1,
  p2,
}: {
  x: number;
  y: number;
  match: BracketMatch;
  p1: ParticipantInfo | null | undefined;
  p2: ParticipantInfo | null | undefined;
}) {
  const isCompleted = match.status === 'COMPLETED';
  const isReady = match.status === 'READY';
  const p1Won = isCompleted && match.winnerId === match.participant1Id;
  const p2Won = isCompleted && match.winnerId === match.participant2Id;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Outer border */}
      <rect
        width={MATCH_W}
        height={MATCH_H}
        className="fill-background"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Status accent on the left */}
      <rect
        x={0}
        y={0}
        width={4}
        height={MATCH_H}
        fill={isCompleted ? '#57f287' : isReady ? '#5865f2' : '#2a2a2a'}
      />
      {/* Divider between players */}
      <line
        x1={0}
        y1={MATCH_H / 2}
        x2={MATCH_W}
        y2={MATCH_H / 2}
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Player 1 */}
      <PlayerRow
        y={0}
        name={p1?.name ?? null}
        seed={p1?.seed ?? null}
        score={match.scoreP1}
        showScore={isCompleted}
        won={p1Won}
      />
      {/* Player 2 */}
      <PlayerRow
        y={MATCH_H / 2}
        name={p2?.name ?? null}
        seed={p2?.seed ?? null}
        score={match.scoreP2}
        showScore={isCompleted}
        won={p2Won}
      />
    </g>
  );
}

function PlayerRow({
  y,
  name,
  seed,
  score,
  showScore,
  won,
}: {
  y: number;
  name: string | null;
  seed: number | null;
  score: number;
  showScore: boolean;
  won: boolean;
}) {
  const isTBD = !name;
  return (
    <g transform={`translate(0, ${y})`}>
      {won && (
        <rect
          x={4}
          y={0}
          width={MATCH_W - 4}
          height={MATCH_H / 2}
          fill="#5865f2"
          opacity={0.18}
        />
      )}
      <text x={14} y={MATCH_H / 4 + 5} fontSize="11" className="fill-muted-foreground">
        {seed ? String(seed).padStart(2, '0') : '--'}
      </text>
      <text
        x={42}
        y={MATCH_H / 4 + 5}
        fontSize="13"
        className={isTBD ? 'fill-muted-foreground' : won ? 'fill-foreground font-bold' : 'fill-foreground'}
      >
        {truncate(name ?? '[ TBD ]', 18)}
      </text>
      {showScore && (
        <text
          x={MATCH_W - 14}
          y={MATCH_H / 4 + 5}
          fontSize="14"
          textAnchor="end"
          className={won ? 'fill-foreground font-bold' : 'fill-muted-foreground'}
        >
          {score}
        </text>
      )}
    </g>
  );
}

function Connector({
  from,
  to,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
}) {
  const x1 = from.x + MATCH_W;
  const y1 = from.y + MATCH_H / 2;
  const x2 = to.x;
  const y2 = to.y + MATCH_H / 2;
  const midX = (x1 + x2) / 2;
  // L-shape: horizontal → vertical → horizontal
  const points = `${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`;
  return <polyline points={points} fill="none" stroke="#2a2a2a" strokeWidth="2" />;
}

function computeLayout(matches: BracketMatch[]): {
  positions: Map<string, { x: number; y: number }>;
  viewBox: string;
} {
  const positions = new Map<string, { x: number; y: number }>();
  if (matches.length === 0) return { positions, viewBox: '0 0 800 400' };

  const byRound = new Map<number, BracketMatch[]>();
  for (const m of matches) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  for (const arr of byRound.values()) arr.sort((a, b) => a.matchNumber - b.matchNumber);

  // Round 1
  const r1 = byRound.get(1) ?? [];
  r1.forEach((m, i) => {
    positions.set(m.id, {
      x: PADDING,
      y: PADDING + 24 + i * (MATCH_H + GAP_V),
    });
  });

  // Rounds 2..N
  for (let r = 2; r <= rounds[rounds.length - 1]!; r++) {
    const round = byRound.get(r) ?? [];
    round.forEach((m) => {
      const feeders = matches.filter((x) => x.nextMatchId === m.id);
      const fs = feeders.map((f) => positions.get(f.id)).filter(Boolean) as Array<{
        x: number;
        y: number;
      }>;
      const y =
        fs.length === 2
          ? (fs[0]!.y + fs[1]!.y) / 2
          : fs.length === 1
            ? fs[0]!.y
            : PADDING + 24;
      positions.set(m.id, {
        x: PADDING + (r - 1) * (MATCH_W + GAP_H),
        y,
      });
    });
  }

  // Compute viewBox
  let maxX = 0;
  let maxY = 0;
  for (const p of positions.values()) {
    maxX = Math.max(maxX, p.x + MATCH_W);
    maxY = Math.max(maxY, p.y + MATCH_H);
  }
  const viewBox = `0 0 ${maxX + PADDING} ${maxY + PADDING}`;
  return { positions, viewBox };
}

function roundLabels(matches: BracketMatch[]): Array<{ round: number; x: number; label: string }> {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const total = rounds.length;
  return rounds.map((r) => ({
    round: r,
    x: PADDING + (r - 1) * (MATCH_W + GAP_H),
    label:
      r === total
        ? 'Final'
        : r === total - 1
          ? 'Semis'
          : r === total - 2
            ? 'Cuartos'
            : `Round ${r}`,
  }));
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
