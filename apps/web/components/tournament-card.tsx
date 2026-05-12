import Link from 'next/link';
import type { TournamentFormat, TournamentStatus } from '@camibot/db';

interface Props {
  id: string;
  name: string;
  slug: string;
  format: TournamentFormat;
  status: TournamentStatus;
  participantsCount: number;
  maxParticipants: number;
  createdAt: Date | string;
  myRole?: 'creator' | 'participant';
  myFinalRank?: number | null;
  myStatus?: string;
}

const formatLabel: Record<TournamentFormat, string> = {
  SINGLE_ELIMINATION: 'Eliminación simple',
  DOUBLE_ELIMINATION: 'Doble eliminación',
  ROUND_ROBIN: 'Round robin',
  SWISS: 'Sistema suizo',
};

const statusLabel: Record<TournamentStatus, string> = {
  DRAFT: 'Borrador',
  REGISTRATION: 'Inscripciones abiertas',
  CHECK_IN: 'Check-in',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

function statusClass(s: TournamentStatus): string {
  switch (s) {
    case 'IN_PROGRESS':
      return 'text-primary';
    case 'COMPLETED':
      return 'text-success';
    case 'CANCELLED':
      return 'text-danger';
    case 'REGISTRATION':
    case 'CHECK_IN':
      return 'text-warning';
    default:
      return 'text-muted-foreground';
  }
}

export function TournamentCard(props: Props) {
  const date = new Date(props.createdAt);
  const dateLabel = date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Link
      href={`/t/${props.id}`}
      className="group flex flex-col gap-3 border-2 border-border bg-card p-5 transition hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold uppercase leading-tight tracking-tight">
          {props.name}
        </h3>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-widest ${statusClass(
            props.status,
          )}`}
        >
          {statusLabel[props.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="text-muted-foreground">Formato</div>
        <div className="text-right">{formatLabel[props.format]}</div>
        <div className="text-muted-foreground">Inscriptos</div>
        <div className="text-right tabular-nums">
          {props.participantsCount} / {props.maxParticipants}
        </div>
        <div className="text-muted-foreground">Creado</div>
        <div className="text-right">{dateLabel}</div>
        {props.myFinalRank ? (
          <>
            <div className="text-muted-foreground">Tu posición</div>
            <div className="text-right font-bold">#{props.myFinalRank}</div>
          </>
        ) : null}
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {props.myRole === 'creator' ? 'Creado por vos' : 'Participás'}
        </span>
        <span className="text-xs text-muted-foreground group-hover:text-foreground">
          Ver bracket →
        </span>
      </div>
    </Link>
  );
}
