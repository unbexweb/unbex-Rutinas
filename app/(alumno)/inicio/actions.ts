"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuario } from "@/lib/auth/usuario";
import { texto, type EstadoForm } from "@/lib/auth/validar";

const TIPOS = ["Volumen", "Definición", "Otro"];

// Pedir el próximo ciclo está disponible siempre (también con entrenamientos pendientes):
// la función de la base finaliza la asignación y crea la solicitud en un solo paso.
export async function pedirProximoCiclo(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const usuario = await getUsuario();
  if (!usuario) return { error: "Tu sesión se cerró. Volvé a entrar." };

  const tipo = texto(formData, "tipo");
  const asignacionId = texto(formData, "asignacion_id");
  const nota = texto(formData, "nota").slice(0, 500);
  if (!TIPOS.includes(tipo)) return { error: "Elegí qué ciclo querés." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("pedir_proximo_ciclo", {
    p_asignacion_id: asignacionId,
    p_tipo: tipo,
    p_nota: nota,
  });
  if (error) return { error: "No pudimos enviar el pedido. Probá de nuevo en un rato." };

  revalidatePath("/", "layout");
  return { ok: "Pedido enviado" };
}
