import type { ClanRow } from './board';

type Props = {
  clans: ClanRow[];
};

const TARGET_A = 'vzltm';
const TARGET_B = 'vnltm';

function findClan(clans: ClanRow[], slugOrName: string): ClanRow | undefined {
  const needle = slugOrName.toLowerCase();
  return clans.find(
    (c) => c.slug.toLowerCase() === needle || c.name.toLowerCase().replace(/\s+/g, '') === needle,
  );
}

function fmt(n: number): string {
  return n.toLocaleString('es-CL');
}

export function CneBanner({ clans }: Props) {
  const a = findClan(clans, TARGET_A);
  const b = findClan(clans, TARGET_B);

  // Si existen, amplifico los votos reales con multiplicador "electoral" + base.
  // Si no, hardcodeo los números del meme.
  const baseA = 1_064_415;
  const baseB = 1_062_172;
  const votesA = a ? baseA + a.votes * 50_321 : baseA;
  const votesB = b ? baseB + b.votes * 50_321 : baseB;
  const total = votesA + votesB;
  const pctA = ((votesA / total) * 100).toFixed(2);
  const pctB = ((votesB / total) * 100).toFixed(2);
  const lead = Math.abs(votesA - votesB);
  const leader = votesA >= votesB ? 'VZLTM' : 'VNLTM';

  const now = new Date();
  const time = now.toLocaleTimeString('es-HN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Tegucigalpa',
  });
  const date = now.toLocaleDateString('es-HN', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Tegucigalpa',
  });

  return (
    <section
      className="mb-6 border-2 border-border-strong bg-[#f4f5f7] p-6 text-[#1e293b]"
      aria-label="Anuncio CNE: resultados parciales"
    >
      <div className="mb-4 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/6/63/CNE_logo.svg"
          alt="Logo CNE Honduras"
          className="h-16 w-auto"
        />
      </div>

      <div className="text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#dc2626]">
          Votaciones Superiores · CNE
        </div>
        <h2 className="mt-1 text-3xl font-black uppercase tracking-tight text-[#0f172a]">
          Resultados parciales
        </h2>
        <p className="mt-1 text-xs text-[#64748b]">
          La Junta Directiva del CNE ha decidido los resultados. Actualización {time}, {date}.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CandidateCard
          name="VZLTM"
          votes={votesA}
          pct={pctA}
          ringColor="#dc2626"
          isLeader={leader === 'VZLTM'}
        />
        <CandidateCard
          name="VNLTM"
          votes={votesB}
          pct={pctB}
          ringColor="#2563eb"
          isLeader={leader === 'VNLTM'}
        />
      </div>

      <div className="mt-6 border-2 border-[#1e293b]/20 bg-white px-4 py-3 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#64748b]">
          Ventaja de {leader}:
        </span>{' '}
        <span className="text-base font-black text-[#0f172a]">{fmt(lead)} votos</span>
      </div>

      <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-[#64748b]">
        Este anuncio es una ficción del catálogo Tournify. No representa una elección real.
      </p>
    </section>
  );
}

function CandidateCard({
  name,
  votes,
  pct,
  ringColor,
  isLeader,
}: {
  name: string;
  votes: number;
  pct: string;
  ringColor: string;
  isLeader: boolean;
}) {
  return (
    <div className="flex flex-col items-center border border-[#e2e8f0] bg-white p-4">
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full border-4 font-black text-[#0f172a]"
        style={{ borderColor: ringColor }}
      >
        <span className="text-xl tracking-tight">{name.slice(0, 5)}</span>
      </div>
      <div className="mt-3 text-center">
        <div className="text-sm font-bold uppercase tracking-wider text-[#0f172a]">{name}</div>
        <div className="text-[10px] uppercase tracking-widest text-[#64748b]">votos</div>
        <div
          className="mt-1 text-2xl font-black"
          style={{ color: isLeader ? ringColor : '#0f172a' }}
        >
          {fmt(votes)}
        </div>
        <div className="text-sm font-bold" style={{ color: ringColor }}>
          {pct}%
        </div>
      </div>
    </div>
  );
}
