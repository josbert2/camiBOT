import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { isAdmin } from '@/lib/admin';

export async function Nav() {
  const session = await auth();

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest"
        >
          <span className="text-base">🏆</span>
          <span>camiBOT</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <NavLink href="/players">Ranking</NavLink>
          <NavLink href="/comandos">Comandos</NavLink>
          {session?.user?.id && <NavLink href="/dashboard">Mi panel</NavLink>}
          {isAdmin(session) && (
            <NavLink href="/admin" highlight>
              Admin
            </NavLink>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Menu móvil minimal: solo Ranking + Comandos como chips */}
          <div className="flex gap-1 md:hidden">
            <NavLink href="/players" small>
              Ranking
            </NavLink>
            <NavLink href="/comandos" small>
              Cmds
            </NavLink>
          </div>

          {session?.user?.id ? (
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button
                type="submit"
                className="border-2 border-border bg-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition hover:border-danger hover:text-danger"
              >
                Salir
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="border-2 border-border-strong bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground transition hover:bg-foreground hover:text-background"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  children,
  highlight = false,
  small = false,
}: {
  href: string;
  children: React.ReactNode;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={href as any}
      className={`border-2 ${
        highlight ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
      } ${small ? 'px-2 py-1 text-[10px]' : 'px-3 py-1 text-xs'} font-bold uppercase tracking-widest transition hover:border-border-strong hover:text-foreground`}
    >
      {children}
    </Link>
  );
}
