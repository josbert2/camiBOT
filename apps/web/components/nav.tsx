import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  TargetIcon,
  RankingIcon,
  TerminalIcon,
  DashboardSquare01Icon,
  ShieldUserIcon,
  Logout03Icon,
  Login03Icon,
} from '@hugeicons/core-free-icons';
import { auth, signOut } from '@/auth';
import { isAdmin } from '@/lib/admin';

export async function Nav() {
  const session = await auth();

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <HugeiconsIcon icon={TargetIcon} className="h-5 w-5 text-primary" />
          <span className="display text-xl tracking-widest">TOURNIFY</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <NavLink href="/players" icon={RankingIcon}>
            Ranking
          </NavLink>
          <NavLink href="/comandos" icon={TerminalIcon}>
            Ops
          </NavLink>
          {session?.user?.id && (
            <NavLink href="/dashboard" icon={DashboardSquare01Icon}>
              HQ
            </NavLink>
          )}
          {isAdmin(session) && (
            <NavLink href="/admin" icon={ShieldUserIcon} highlight>
              Command
            </NavLink>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 md:hidden">
            <NavLink href="/players" icon={RankingIcon} small />
            <NavLink href="/comandos" icon={TerminalIcon} small />
          </div>

          {session?.user?.id ? (
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button type="submit" className="btn-ghost text-xs hover:!border-danger hover:!text-danger">
                <HugeiconsIcon icon={Logout03Icon} className="h-4 w-4" />
                <span>Salir</span>
              </button>
            </form>
          ) : (
            <Link href="/login" className="btn-tactical text-xs">
              <HugeiconsIcon icon={Login03Icon} className="h-4 w-4" />
              <span>Acceso</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  icon,
  children,
  highlight = false,
  small = false,
}: {
  href: string;
  icon: typeof TargetIcon;
  children?: React.ReactNode;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={href as any}
      className={`flex items-center gap-2 border-2 ${
        highlight
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground'
      } ${small ? 'px-2 py-1' : 'px-3 py-1.5'} font-bold uppercase transition hover:border-border-strong hover:text-foreground`}
    >
      <HugeiconsIcon icon={icon} className={small ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {children && (
        <span
          className={`display ${small ? 'text-[10px]' : 'text-xs'} tracking-widest`}
        >
          {children}
        </span>
      )}
    </Link>
  );
}
