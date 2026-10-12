"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import e from "./estilos.module.css";

type Resultado = { ok: true } | { ok: false; error: string; enUso?: true };

type Props = {
  nombre: string;
  eliminar: () => Promise<Resultado>;
  desactivar: () => Promise<{ ok: boolean }>;
};

// Si el ejercicio está en uso no se puede borrar: se ofrece desactivarlo (deja de aparecer en el buscador).
export function BotonEliminarEjercicio({ nombre, eliminar, desactivar }: Props) {
  const router = useRouter();
  const [ocupado, empezar] = useTransition();
  const [aviso, setAviso] = useState<{ texto: string; enUso: boolean } | null>(null);

  function borrar() {
    if (!window.confirm(`¿Borrar “${nombre}” de la biblioteca?`)) return;
    setAviso(null);
    empezar(async () => {
      const res = await eliminar().catch(() => ({ ok: false as const, error: "Algo salió mal. Probá de nuevo." }));
      if (res.ok) router.refresh();
      else setAviso({ texto: res.error, enUso: "enUso" in res && Boolean(res.enUso) });
    });
  }

  function apagar() {
    empezar(async () => {
      await desactivar();
      setAviso(null);
      router.refresh();
    });
  }

  return (
    <span>
      <button type="button" className={`${e.btn} ${e.btnPeligro}`} onClick={borrar} disabled={ocupado}>
        Borrar
      </button>
      {aviso && (
        <span role="alert" className={e.stack} style={{ marginTop: "var(--space-2)" }}>
          <span className={e.error}>{aviso.texto}</span>
          {aviso.enUso && (
            <>
              <span className={e.ayuda}>Podés desactivarlo: deja de aparecer en el buscador del editor, pero los planes que ya lo usan no se rompen.</span>
              <button type="button" className={e.btn} onClick={apagar} disabled={ocupado}>
                Desactivar
              </button>
            </>
          )}
        </span>
      )}
    </span>
  );
}
