"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Mensaje } from "@/components/ui/Mensaje";
import type { EstadoForm } from "@/lib/auth/validar";
import { pedirProximoCiclo } from "./actions";
import styles from "./inicio.module.css";

const TIPOS = ["Volumen", "Definición", "Otro"];

export function FormSolicitud({ asignacionId }: { asignacionId: string }) {
  const [estado, accion] = useActionState<EstadoForm, FormData>(pedirProximoCiclo, {});

  return (
    <form action={accion} className={styles.form}>
      <h2>Pedí tu próximo ciclo</h2>
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      <input type="hidden" name="asignacion_id" value={asignacionId} />
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>¿Qué te gustaría hacer?</legend>
        {TIPOS.map((tipo, i) => (
          <label key={tipo} className={styles.opcion}>
            <input type="radio" name="tipo" value={tipo} defaultChecked={i === 0} />
            {tipo}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="nota" className={styles.legend}>
          Comentario (opcional)
        </label>
        <textarea id="nota" name="nota" className={styles.textarea} maxLength={500} />
      </div>
      <Boton>Pedir próximo ciclo</Boton>
    </form>
  );
}
