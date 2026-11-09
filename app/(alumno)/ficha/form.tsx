"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Mensaje } from "@/components/ui/Mensaje";
import styles from "@/components/ui/Formulario.module.css";
import type { EstadoForm } from "@/lib/auth/validar";
import type { Tables } from "@/types/database";
import { guardarFicha } from "./actions";
import { CAMPOS_FICHA } from "./campos";
import estilos from "./ficha.module.css";

export function FormFicha({ ficha }: { ficha: Tables<"fichas_salud"> | null }) {
  const [estado, accion] = useActionState<EstadoForm, FormData>(guardarFicha, {});

  return (
    <form action={accion} className={`${styles.form} ${estilos.tarjeta}`}>
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      {estado.ok && <Mensaje tipo="exito">{estado.ok}</Mensaje>}
      {CAMPOS_FICHA.map((campo) => (
        <div key={campo.name} className={estilos.campo}>
          <label htmlFor={campo.name} className={estilos.label}>
            {campo.label}
          </label>
          <textarea
            id={campo.name}
            name={campo.name}
            className={estilos.textarea}
            defaultValue={ficha?.[campo.name] ?? ""}
            maxLength={1000}
          />
        </div>
      ))}
      <Boton>Guardar ficha</Boton>
    </form>
  );
}
