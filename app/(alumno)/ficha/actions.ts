"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuario } from "@/lib/auth/usuario";
import { texto, type EstadoForm } from "@/lib/auth/validar";
import { CAMPOS_FICHA } from "./campos";

export async function guardarFicha(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const usuario = await getUsuario();
  if (!usuario) return { error: "Tu sesión se cerró. Volvé a entrar." };

  const datos: Record<string, string | null> = {};
  for (const { name } of CAMPOS_FICHA) datos[name] = texto(formData, name).slice(0, 1000) || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("fichas_salud")
    .upsert({ alumno_id: usuario.user.id, ...datos }, { onConflict: "alumno_id" });
  if (error) return { error: "No pudimos guardar tu ficha. Probá de nuevo." };

  revalidatePath("/ficha");
  return { ok: "¡Listo! Guardamos tu ficha." };
}
