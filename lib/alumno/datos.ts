import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Asignacion = Tables<"asignaciones">;

export const SESIONES_POR_PLAN = 24;

// La asignación vigente del alumno: la activa o, si no hay, la última finalizada.
// RLS ya limita todo al propio alumno.
export const getAsignacion = cache(async (): Promise<Asignacion | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("asignaciones")
    .select("*")
    .order("created_at", { ascending: false });
  if (!data?.length) return null;
  return data.find((a) => a.estado === "activa") ?? data[0] ?? null;
});

// El plan es libre: el progreso son los entrenamientos completos, no "por dónde va".
// semana_actual/estimulo_actual solo guardan el primer pendiente (el sugerido).
export const getProgreso = cache(async (asignacionId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registros_sesion")
    .select("sesion_id")
    .eq("asignacion_id", asignacionId)
    .eq("completada", true);
  const completadas = new Set((data ?? []).map((r) => r.sesion_id));
  return { hechos: completadas.size, completadas };
});
