"use client";

import { useActionState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Mensaje } from "@/components/ui/Mensaje";
import type { EstadoForm } from "@/lib/auth/validar";
import e from "./estilos.module.css";

type Props = {
  accion: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  textoBoton: string;
  inicial?: { nombre: string; tipo: string; nivel: string };
  idPrefijo: string;
};

const TIPOS_SUGERIDOS = ["Volumen", "Definición"];

// Datos de un plan: sirve para crear uno nuevo y para duplicar uno existente.
export function FormPlan({ accion, textoBoton, inicial, idPrefijo }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(accion, {});
  const v = estado.valores ?? inicial;
  const lista = `${idPrefijo}-tipos`;

  return (
    <form action={enviar} className={`${e.stack}`} style={{ maxWidth: "28rem" }}>
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      <Campo name="nombre" label="Nombre" defaultValue={v?.nombre} error={estado.errores?.nombre} required />
      <Campo
        name="tipo"
        label="Tipo"
        list={lista}
        ayuda="Volumen, Definición u otro"
        defaultValue={v?.tipo}
        error={estado.errores?.tipo}
        required
      />
      <datalist id={lista}>
        {TIPOS_SUGERIDOS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Campo name="nivel" label="Nivel (opcional)" defaultValue={v?.nivel} />
      <Boton>{textoBoton}</Boton>
    </form>
  );
}
