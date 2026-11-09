import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SesionEditor } from "@/lib/staff/editor-tipos";
import { EditorPlan } from "./editor";

export const metadata = { title: "Editor de plan · Unbex Rutinas" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditorPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("planes")
    .select("id, nombre, tipo, nivel, alumno_id, alumno:profiles!planes_alumno_id_fkey (nombre, apellido)")
    .eq("id", id)
    .maybeSingle();
  if (!plan) notFound();

  const [{ data: sesiones }, { data: biblioteca }, { data: asignaciones }] = await Promise.all([
    supabase
      .from("sesiones")
      .select(
        `id, semana, estimulo,
         bloques (
           id, orden, nombre, indicacion,
           bloque_ejercicios (
             id, orden, ejercicio_id, alternativa_id, series, reps, carga_sugerida, registra_carga, nota, grupo
           )
         )`,
      )
      .eq("plan_id", id)
      .order("semana")
      .order("estimulo"),
    supabase.from("ejercicios").select("id, nombre, activo").order("nombre"),
    supabase.from("asignaciones").select("alumno_id").eq("plan_id", id).eq("estado", "activa"),
  ]);

  const inicial: SesionEditor[] = (sesiones ?? []).map((s) => ({
    id: s.id,
    semana: s.semana,
    estimulo: s.estimulo,
    bloques: [...s.bloques]
      .sort((a, b) => a.orden - b.orden)
      .map((b) => ({
        id: b.id,
        orden: b.orden,
        nombre: b.nombre,
        indicacion: b.indicacion,
        ejercicios: [...b.bloque_ejercicios].sort((a, c) => a.orden - c.orden),
      })),
  }));

  return (
    <EditorPlan
      plan={{ id: plan.id, nombre: plan.nombre, tipo: plan.tipo, nivel: plan.nivel ?? "" }}
      personalizadoDe={plan.alumno ? `${plan.alumno.nombre} ${plan.alumno.apellido}` : null}
      alumnosActivos={new Set((asignaciones ?? []).map((a) => a.alumno_id)).size}
      sesiones={inicial}
      biblioteca={biblioteca ?? []}
    />
  );
}
