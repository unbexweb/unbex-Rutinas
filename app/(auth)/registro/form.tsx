"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Mensaje } from "@/components/ui/Mensaje";
import styles from "@/components/ui/Formulario.module.css";
import type { EstadoForm } from "@/lib/auth/validar";
import { registrarse } from "./actions";

export function FormRegistro() {
  const [estado, accion] = useActionState<EstadoForm, FormData>(registrarse, {});
  const v = estado.valores;
  const e = estado.errores;

  return (
    <form action={accion} className={styles.form}>
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      {estado.ok && <Mensaje tipo="exito">{estado.ok}</Mensaje>}
      <Campo name="nombre" label="Nombre" autoComplete="given-name" defaultValue={v?.nombre} error={e?.nombre} required />
      <Campo name="apellido" label="Apellido" autoComplete="family-name" defaultValue={v?.apellido} error={e?.apellido} required />
      <Campo
        name="dni"
        label="DNI"
        inputMode="numeric"
        autoComplete="off"
        ayuda="Solo números, sin puntos"
        defaultValue={v?.dni}
        error={e?.dni}
        required
      />
      <Campo
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        defaultValue={v?.email}
        error={e?.email}
        required
      />
      <Campo
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        minLength={8}
        ayuda="Mínimo 8 caracteres"
        error={e?.password}
        required
      />
      <Boton>Crear cuenta</Boton>
      <div className={styles.links}>
        <Link href="/login" className={styles.link}>
          Ya tengo cuenta
        </Link>
      </div>
    </form>
  );
}
