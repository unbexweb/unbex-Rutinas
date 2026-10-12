"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuario } from "@/lib/auth/usuario";
import { texto, type EstadoForm } from "@/lib/auth/validar";

const TIPOS = ["Volumen", "Definición", "Otro"];

export async function pedirProximoCiclo(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const usuario = await getUsuario();
  if (!usuario) return { error: "Tu sesión se cerró. Volvé a entrar." };

  const tipo = texto(formData, "tipo");
  const asignacionId = texto(formData, "asignacion_id");
  const nota = texto(formData, "nota").slice(0, 500);
  if (!TIPOS.includes(tipo)) return { error: "Elegí qué ciclo querés." };

  const supabase = await createClient();

  // Una sola solicitud pendiente por asignación.
  const { data: previa } = await supabase
    .from("solicitudes_ciclo")
    .select("id")
    .eq("asignacion_id", asignacionId)
    .eq("estado", "pendiente")
    .limit(1);
  if (!previa?.length) {
    // RLS exige que la asignación sea del alumno y esté finalizada.
    const { error } = await supabase.from("solicitudes_ciclo").insert({
      alumno_id: usuario.user.id,
      asignacion_id: asignacionId,
      tipo_solicitado: tipo,
      nota: nota || null,
    });
    if (error) return { error: "No pudimos enviar el pedido. Probá de nuevo en un rato." };
  }

  revalidatePath("/inicio");
  return {};
}
