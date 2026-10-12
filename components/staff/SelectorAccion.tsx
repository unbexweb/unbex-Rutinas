"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { ResultadoStaff } from "@/lib/staff/tipos";
import e from "./estilos.module.css";

type Props = {
  etiqueta: string;
  texto: string;
  opciones: { value: string; label: string }[];
  valorInicial?: string;
  accion: (valor: string) => Promise<ResultadoStaff>;
  confirmar?: string;
};

// Un desplegable más un botón que ejecuta una acción con el valor elegido.
export function SelectorAccion({ etiqueta, texto, opciones, valorInicial, accion, confirmar }: Props) {
  const router = useRouter();
  const id = useId();
  const [valor, setValor] = useState(valorInicial ?? "");
  const [ocupado, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ejecutar() {
    if (!valor) {
      setError("Elegí una opción.");
      return;
    }
    if (confirmar && !window.confirm(confirmar)) return;
    setError(null);
    empezar(async () => {
      const res = await accion(valor).catch(() => ({ ok: false as const, error: "Algo salió mal. Probá de nuevo." }));
      if (!res.ok) setError(res.error);
      else if (res.irA) router.push(res.irA);
      else router.refresh();
    });
  }

  return (
    <div>
      <div className={e.formEnLinea}>
        <div className={e.stack}>
          <label htmlFor={id}>{etiqueta}</label>
          <select id={id} className={e.select} value={valor} onChange={(ev) => setValor(ev.target.value)}>
            <option value="">Elegí…</option>
            {opciones.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={e.btn} onClick={ejecutar} disabled={ocupado}>
          {ocupado ? "Un momento…" : texto}
        </button>
      </div>
      {error && (
        <p role="alert" className={e.error}>
          {error}
        </p>
      )}
    </div>
  );
}
