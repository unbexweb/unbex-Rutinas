"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { texto, type EstadoForm } from "@/lib/auth/validar";
import { SIN_PERMISO, verificarStaff } from "@/lib/staff/auth";
import type { ResultadoStaff } from "@/lib/staff/tipos";
import { extraerYoutubeId } from "@/lib/youtube";

export async function guardarEjercicio(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const usuario = await verificarStaff();
  if (!usuario) return { error: SIN_PERMISO };

  const id = texto(formData, "id");
  const nombre = texto(formData, "nombre").slice(0, 120);
  const videoUrl = texto(formData, "video_url").slice(0, 300);
  const descripcion = texto(formData, "descripcion").slice(0, 500);
  const valores = { id, nombre, video_url: videoUrl, descripcion };

  if (!nombre) return { errores: { nombre: "Ingresá el nombre del ejercicio" }, valores };

  const datos = {
    nombre,
    video_url: videoUrl || null,
    youtube_id: videoUrl ? extraerYoutubeId(videoUrl) : null,
    descripcion: descripcion || null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("ejercicios").update(datos).eq("id", id)
    : await supabase.from("ejercicios").insert({ ...datos, gym_id: usuario.profile.gym_id });

  if (error) {
    if (error.code === "23505") return { errores: { nombre: "Ya hay un ejercicio con ese nombre" }, valores };
    return { error: "No pudimos guardar el ejercicio.", valores };
  }

  redirect("/panel/ejercicios");
}

export async function cambiarActivo(ejercicioId: string, activo: boolean): Promise<ResultadoStaff> {
  if (!(await verificarStaff())) return { ok: false, error: SIN_PERMISO };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ejercicios").update({ activo }).eq("id", ejercicioId).select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos cambiar el ejercicio." };
  return { ok: true };
}

export type ResultadoEliminar = ResultadoStaff | { ok: false; error: string; enUso: true };

export async function eliminarEjercicio(ejercicioId: string): Promise<ResultadoEliminar> {
  if (!(await verificarStaff())) return { ok: false, error: SIN_PERMISO };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ejercicios").delete().eq("id", ejercicioId).select("id");

  // 23503: lo usa algún plan o algún historial.
  if (error?.code === "23503") {
    return {
      ok: false,
      enUso: true,
      error: "Este ejercicio está en uso en planes o en historiales, así que no se puede borrar.",
    };
  }
  if (error || !data?.length) return { ok: false, error: "No pudimos borrar el ejercicio." };
  return { ok: true };
}
