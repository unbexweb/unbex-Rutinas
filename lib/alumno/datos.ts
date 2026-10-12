import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Asignacion = Tables<"asignaciones">;

export const SESIONES_POR_PLAN = 24;

// Posición (1 a 24) de una sesión dentro del plan.
export const posicion = (semana: number, estimulo: number) => (semana - 1) * 6 + estimulo;

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

// Cuántos entrenamientos hizo en la asignación.
export function hechos(a: Asignacion): number {
  return a.estado === "finalizada"
    ? SESIONES_POR_PLAN
    : posicion(a.semana_actual, a.estimulo_actual) - 1;
}
