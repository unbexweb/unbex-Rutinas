"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Mensaje } from "@/components/ui/Mensaje";
import type { EstadoForm } from "@/lib/auth/validar";
import e from "./estilos.module.css";

export type EstadoAlta = EstadoForm & { credenciales?: { nombre: string; email: string; password: string } };

type Props = {
  accion: (prev: EstadoAlta, formData: FormData) => Promise<EstadoAlta>;
  textoBoton: string;
  volverHref: string;
  volverTexto: string;
};

// Alta de alumno o profe. La contraseña temporal se muestra una sola vez, al terminar.
export function FormAlta({ accion, textoBoton, volverHref, volverTexto }: Props) {
  const [estado, enviar] = useActionState<EstadoAlta, FormData>(accion, {});
  const [copiado, setCopiado] = useState(false);
  const v = estado.valores;
  const err = estado.errores;

  if (estado.credenciales) {
    const c = estado.credenciales;
    return (
      <div className={`${e.panel} ${e.stack}`}>
        <Mensaje tipo="exito">Listo, creamos la cuenta de {c.nombre}.</Mensaje>
        <p>Pasale estos datos. Esta contraseña no se vuelve a mostrar:</p>
        <dl className={e.datos}>
          <dt>Email</dt>
          <dd>{c.email}</dd>
          <dt>Contraseña</dt>
          <dd>
            <span className={e.clave}>{c.password}</span>
          </dd>
        </dl>
        <div className={e.fila}>
          <button
            type="button"
            className={e.btn}
            onClick={() => {
              navigator.clipboard
                ?.writeText(`Email: ${c.email}\nContraseña: ${c.password}`)
                .then(() => setCopiado(true))
                .catch(() => setCopiado(false));
            }}
          >
            {copiado ? "¡Copiado!" : "Copiar datos"}
          </button>
          <Link href={volverHref} className={`${e.btn} ${e.btnSec}`}>
            {volverTexto}
          </Link>
        </div>
        <p className={e.ayuda}>Le conviene cambiarla en su primer ingreso desde “¿Olvidaste tu contraseña?”.</p>
      </div>
    );
  }

  return (
    <form action={enviar} className={`${e.panel} ${e.stack}`} style={{ maxWidth: "32rem" }}>
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      <Campo name="nombre" label="Nombre" autoComplete="off" defaultValue={v?.nombre} error={err?.nombre} required />
      <Campo name="apellido" label="Apellido" autoComplete="off" defaultValue={v?.apellido} error={err?.apellido} required />
      <Campo
        name="dni"
        label="DNI"
        inputMode="numeric"
        autoComplete="off"
        ayuda="Solo números, sin puntos"
        defaultValue={v?.dni}
        error={err?.dni}
        required
      />
      <Campo
        name="email"
        label="Email"
        type="email"
        autoComplete="off"
        autoCapitalize="none"
        defaultValue={v?.email}
        error={err?.email}
        required
      />
      <Boton>{textoBoton}</Boton>
      <Link href={volverHref} className={`${e.btn} ${e.btnSec}`}>
        Cancelar
      </Link>
    </form>
  );
}
