"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { texto, type EstadoForm } from "@/lib/auth/validar";
import { SIN_PERMISO, verificarStaff } from "@/lib/staff/auth";
import { mensajeDe } from "@/lib/staff/errores";
import type { ResultadoStaff } from "@/lib/staff/tipos";

function datosPlan(formData: FormData) {
  const nombre = texto(formData, "nombre");
  const tipo = texto(formData, "tipo");
  const nivel = texto(formData, "nivel");
  const errores: Record<string, string> = {};
  if (!nombre) errores.nombre = "Ingresá un nombre";
  if (!tipo) errores.tipo = "Ingresá un tipo (por ejemplo Volumen)";
  return { nombre, tipo, nivel, errores, valores: { nombre, tipo, nivel } };
}

export async function crearPlan(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const usuario = await verificarStaff();
  if (!usuario) return { error: SIN_PERMISO };

  const { nombre, tipo, nivel, errores, valores } = datosPlan(formData);
  if (Object.keys(errores).length) return { errores, valores };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planes")
    .insert({ gym_id: usuario.profile.gym_id, nombre, tipo, nivel: nivel || null })
    .select("id")
    .single();
  if (error || !data) return { error: "No pudimos crear el plan.", valores };

  redirect(`/panel/planes/${data.id}`);
}

export async function duplicarPlan(planId: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  if (!(await verificarStaff())) return { error: SIN_PERMISO };

  const { nombre, tipo, nivel, errores, valores } = datosPlan(formData);
  if (Object.keys(errores).length) return { errores, valores };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicar_plan", {
    p_plan_id: planId,
    p_nombre: nombre,
    p_tipo: tipo,
    p_nivel: nivel,
  });
  if (error || !data) return { error: mensajeDe(error, "No pudimos duplicar el plan."), valores };

  redirect(`/panel/planes/${data}`);
}

export async function eliminarPlan(planId: string): Promise<ResultadoStaff> {
  if (!(await verificarStaff())) return { ok: false, error: SIN_PERMISO };
  const supabase = await createClient();

  // Un plan con asignaciones (activas o históricas) no se puede borrar: se avisa antes de llegar al error de la base.
  const { data: asignaciones } = await supabase
    .from("asignaciones")
    .select("alumno_id, estado")
    .eq("plan_id", planId);
  if (asignaciones?.length) {
    const alumnos = new Set(asignaciones.map((a) => a.alumno_id)).size;
    return {
      ok: false,
      error: `No se puede eliminar: lo tienen asignado (o lo tuvieron) ${alumnos} ${
        alumnos === 1 ? "alumno" : "alumnos"
      }. Asignales otro plan; los planes con historial no se borran.`,
    };
  }

  const { data, error } = await supabase.from("planes").delete().eq("id", planId).select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos eliminar el plan." };
  return { ok: true, irA: "/panel/planes" };
}
