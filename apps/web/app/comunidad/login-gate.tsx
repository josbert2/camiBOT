'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Login03Icon, Cancel01Icon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { loginWithDiscord } from './actions';

const LoginCtx = createContext<() => void>(() => {});

/** Abre el modal de login desde cualquier hijo del provider. */
export function useLogin(): () => void {
  return useContext(LoginCtx);
}

export function LoginProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openLogin = useCallback(() => setOpen(true), []);

  return (
    <LoginCtx.Provider value={openLogin}>
      {children}
      {open && <LoginModal onClose={() => setOpen(false)} />}
    </LoginCtx.Provider>
  );
}

function LoginModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-background/85 backdrop-blur-sm"
      />

      <div className="hud-panel-strong relative z-10 w-full max-w-md p-8 scanlines">
        <div className="mb-4 flex items-center justify-between">
          <div className="tag-tactical flex items-center gap-2">
            <HugeiconsIcon icon={UserGroupIcon} className="h-3.5 w-3.5" />
            <span>// ACCESO</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="border-2 border-transparent p-1.5 text-muted-foreground transition hover:border-border-strong hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        </div>

        <h2 className="stencil text-4xl leading-none">Sumate a la operación</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Iniciá sesión con Discord para subir tus clips, reaccionar y comentar las plays de los demás.
        </p>

        <form action={loginWithDiscord} className="mt-6">
          <button type="submit" className="btn-tactical w-full justify-center">
            <HugeiconsIcon icon={Login03Icon} className="h-4 w-4" />
            <span>Continuar con Discord</span>
          </button>
        </form>

        <p className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
          Solo tomamos identidad básica + lista de servers donde sos admin.
        </p>
      </div>
    </div>
  );
}
