import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-16">
      {/* Header marker */}
      <div className="mb-16 flex items-center justify-between border-b-2 border-border-strong pb-4">
        <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          [camibot/v0.0.0]
        </span>
        <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          phase_0:setup
        </span>
      </div>

      {/* Hero */}
      <section className="flex flex-1 flex-col justify-center">
        <h1 className="mb-8 text-5xl font-bold uppercase leading-[0.95] tracking-tight md:text-7xl">
          Host
          <br />
          tournaments
          <br />
          <span className="bg-primary px-2 text-primary-foreground">in discord.</span>
        </h1>

        <p className="mb-12 max-w-xl text-base text-muted-foreground md:text-lg">
          Single elim, double elim, round robin. Brackets, registration, check-in,
          leaderboards. Todo nativo del server.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="#"
            className="border-2 border-border-strong bg-foreground px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-background transition hover:bg-primary hover:text-primary-foreground"
          >
            Invitar bot
          </Link>
          <Link
            href="/dashboard"
            className="border-2 border-border-strong bg-transparent px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-foreground transition hover:bg-foreground hover:text-background"
          >
            Dashboard →
          </Link>
        </div>
      </section>

      {/* Status bar */}
      <footer className="mt-16 grid grid-cols-2 gap-px border-2 border-border bg-border md:grid-cols-4">
        {[
          { k: 'BOT', v: 'OFFLINE' },
          { k: 'DB', v: 'PENDING' },
          { k: 'WEB', v: 'DEV' },
          { k: 'PHASE', v: '0/5' },
        ].map((s) => (
          <div key={s.k} className="bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {s.k}
            </div>
            <div className="mt-1 text-sm font-bold">{s.v}</div>
          </div>
        ))}
      </footer>
    </main>
  );
}
