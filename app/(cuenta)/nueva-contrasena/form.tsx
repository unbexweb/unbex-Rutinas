"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Mensaje } from "@/components/ui/Mensaje";
import styles from "@/components/ui/Formulario.module.css";
import type { EstadoForm } from "@/lib/auth/validar";
import { cambiarContrasena } from "./actions";

export function FormNuevaContrasena() {
  const [estado, accion] = useActionState<EstadoForm, FormData>(cambiarContrasena, {});

  return (
    <form action={accion} className={styles.form}>
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      <Campo
        name="password"
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        minLength={8}
        ayuda="Mínimo 8 caracteres"
        error={estado.errores?.password}
        required
      />
      <Campo
        name="repetir"
        label="Repetí la contraseña"
        type="password"
        autoComplete="new-password"
        error={estado.errores?.repetir}
        required
      />
      <Boton>Guardar contraseña</Boton>
    </form>
  );
}
