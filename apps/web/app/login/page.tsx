import { signIn } from '@/auth';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="border-2 border-border-strong bg-card p-8">
        <div className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          [auth/login]
        </div>
        <h1 className="mb-8 text-3xl font-bold uppercase">Acceso</h1>
        <form
          action={async () => {
            'use server';
            await signIn('discord', { redirectTo: '/dashboard' });
          }}
        >
          <button
            type="submit"
            className="w-full border-2 border-border-strong bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:bg-foreground hover:text-background"
          >
            Continuar con Discord
          </button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          Solo tomamos identidad básica + lista de servers donde sos admin.
        </p>
      </div>
    </main>
  );
}
