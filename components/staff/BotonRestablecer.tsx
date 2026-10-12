"use client";

import { useState, useTransition } from "react";
import type { ResultadoRestablecer } from "@/lib/staff/restablecer-password";
import e from "./estilos.module.css";

type Props = {
  nombre: string;
  accion: () => Promise<ResultadoRestablecer>;
};

// La contraseña temporal vive solo en el estado del componente: se muestra una vez y no se guarda.
export function BotonRestablecer({ nombre, accion }: Props) {
  const [ocupado, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  function ejecutar() {
    if (!window.confirm(`¿Restablecer la contraseña de ${nombre}? La actual deja de funcionar.`)) return;
    setError(null);
    empezar(async () => {
      const res = await accion().catch(() => ({ ok: false as const, error: "Algo salió mal. Probá de nuevo." }));
      if (res.ok) {
        setCred({ email: res.email, password: res.password });
        setCopiado(false);
      } else setError(res.error);
    });
  }

  if (cred) {
    return (
      <div className={e.stack}>
        <p>Pasale estos datos a {nombre}. Esta contraseña no se vuelve a mostrar:</p>
        <dl className={e.datos}>
          <dt>Email</dt>
          <dd>{cred.email}</dd>
          <dt>Contraseña</dt>
          <dd>
            <span className={e.clave}>{cred.password}</span>
          </dd>
        </dl>
        <div className={e.fila}>
          <button
            type="button"
            className={e.btn}
            onClick={() => {
              navigator.clipboard
                ?.writeText(`Email: ${cred.email}\nContraseña: ${cred.password}`)
                .then(() => setCopiado(true))
                .catch(() => setCopiado(false));
            }}
          >
            {copiado ? "¡Copiado!" : "Copiar datos"}
          </button>
          <button type="button" className={`${e.btn} ${e.btnSec}`} onClick={() => setCred(null)}>
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <span>
      <button type="button" className={`${e.btn} ${e.btnSec}`} onClick={ejecutar} disabled={ocupado}>
        {ocupado ? "Un momento…" : "Restablecer contraseña"}
      </button>
      {error && (
        <p role="alert" className={e.error}>
          {error}
        </p>
      )}
    </span>
  );
}
