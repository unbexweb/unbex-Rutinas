"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ResultadoStaff } from "@/lib/staff/tipos";
import e from "./estilos.module.css";

type Props = {
  texto: string;
  accion: () => Promise<ResultadoStaff>;
  variante?: "primario" | "secundario" | "peligro";
  // Si se pasa, se pide confirmación con este texto antes de ejecutar.
  confirmar?: string;
  deshabilitado?: boolean;
};

const CLASES = { primario: "", secundario: e.btnSec, peligro: e.btnPeligro };

export function BotonAccion({ texto, accion, variante = "primario", confirmar, deshabilitado }: Props) {
  const router = useRouter();
  const [ocupado, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ejecutar() {
    if (confirmar && !window.confirm(confirmar)) return;
    setError(null);
    empezar(async () => {
      const res = await accion().catch(() => ({ ok: false as const, error: "Algo salió mal. Probá de nuevo." }));
      if (!res.ok) setError(res.error);
      else if (res.irA) router.push(res.irA);
      else router.refresh();
    });
  }

  return (
    <span>
      <button
        type="button"
        className={`${e.btn} ${CLASES[variante]}`}
        onClick={ejecutar}
        disabled={ocupado || deshabilitado}
      >
        {ocupado ? "Un momento…" : texto}
      </button>
      {error && (
        <p role="alert" className={e.error}>
          {error}
        </p>
      )}
    </span>
  );
}
