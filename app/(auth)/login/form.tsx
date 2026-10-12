"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Mensaje } from "@/components/ui/Mensaje";
import styles from "@/components/ui/Formulario.module.css";
import type { EstadoForm } from "@/lib/auth/validar";
import { iniciarSesion } from "./actions";

export function FormLogin() {
  const [estado, accion] = useActionState<EstadoForm, FormData>(iniciarSesion, {});

  return (
    <form action={accion} className={styles.form}>
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      <Campo
        name="identificador"
        label="Email o DNI"
        autoComplete="username"
        autoCapitalize="none"
        defaultValue={estado.valores?.identificador}
        required
      />
      <Campo name="password" label="Contraseña" type="password" autoComplete="current-password" required />
      <Boton>Entrar</Boton>
      <div className={styles.links}>
        <Link href="/recuperar" className={styles.link}>
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/registro" className={styles.link}>
          Crear cuenta
        </Link>
      </div>
    </form>
  );
}
