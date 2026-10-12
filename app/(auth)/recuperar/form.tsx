"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Mensaje } from "@/components/ui/Mensaje";
import styles from "@/components/ui/Formulario.module.css";
import type { EstadoForm } from "@/lib/auth/validar";
import { pedirRecuperacion } from "./actions";

export function FormRecuperar() {
  const [estado, accion] = useActionState<EstadoForm, FormData>(pedirRecuperacion, {});

  return (
    <form action={accion} className={styles.form}>
      {estado.ok && <Mensaje tipo="exito">{estado.ok}</Mensaje>}
      <Campo
        name="identificador"
        label="Email o DNI"
        autoComplete="username"
        autoCapitalize="none"
        defaultValue={estado.valores?.identificador}
        error={estado.errores?.identificador}
        required
      />
      <Boton>Enviar mail</Boton>
      <div className={styles.links}>
        <Link href="/login" className={styles.link}>
          Volver a entrar
        </Link>
      </div>
    </form>
  );
}
