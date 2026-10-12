import { notFound, redirect } from "next/navigation";
import { posicion } from "@/lib/alumno/datos";
import type { EjercicioVista, EntrenamientoVista, ItemVista } from "@/lib/alumno/entrenar-tipos";
import { createClient } from "@/lib/supabase/server";
import { Entrenamiento } from "./entrenamiento";

export const metadata = { title: "Entrenar · Unbex Rutinas" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EJERCICIO = "id, nombre, youtube_id, video_url";

function vistaEjercicio(e: { id: string; nombre: string; youtube_id: string | null; video_url: string | null }): EjercicioVista {
  return { id: e.id, nombre: e.nombre, youtubeId: e.youtube_id, videoUrl: e.video_url };
}

// "3" → 3; si el profe cargó algo raro ("3-4") se toma el primer número; sin dato, 3.
function cantidadSeries(texto: string | null): number {
  const n = parseInt(texto ?? "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 3;
}

const fmt = (n: number) => String(n).replace(".", ",");

export default async function EntrenarPage({ params }: { params: Promise<{ sesionId: string }> }) {
  const { sesionId } = await params;
  if (!UUID.test(sesionId)) notFound();

  const supabase = await createClient();

  const { data: sesion } = await supabase
    .from("sesiones")
    .select("id, plan_id, semana, estimulo")
    .eq("id", sesionId)
    .maybeSingle();
  if (!sesion) notFound();

  // La asignación del alumno para el plan de esta sesión (la activa, o la última).
  const { data: asignaciones } = await supabase
    .from("asignaciones")
    .select("*")
    .eq("plan_id", sesion.plan_id)
    .order("created_at", { ascending: false });
  const asignacion = asignaciones?.find((a) => a.estado === "activa") ?? asignaciones?.[0];
  if (!asignacion) notFound();

  // Solo la sesión que toca se edita; las hechas se leen; las que siguen no se abren.
  const pos = posicion(sesion.semana, sesion.estimulo);
  let modo: EntrenamientoVista["modo"] = "leer";
  if (asignacion.estado === "activa") {
    const actual = posicion(asignacion.semana_actual, asignacion.estimulo_actual);
    if (pos > actual) redirect("/plan");
    if (pos === actual) modo = "editar";
  }

  const { data: bloques } = await supabase
    .from("bloques")
    .select(
      `id, orden, nombre, indicacion,
       bloque_ejercicios (
         id, orden, series, reps, carga_sugerida, registra_carga, nota,
         ejercicio:ejercicios!bloque_ejercicios_ejercicio_id_fkey (${EJERCICIO}),
         alternativa:ejercicios!bloque_ejercicios_alternativa_id_fkey (${EJERCICIO})
       )`,
    )
    .eq("sesion_id", sesionId)
    .order("orden");

  const { data: registro } = await supabase
    .from("registros_sesion")
    .select("id")
    .eq("asignacion_id", asignacion.id)
    .eq("sesion_id", sesionId)
    .maybeSingle();

  const { data: guardadas } = registro
    ? await supabase
        .from("registros_series")
        .select("bloque_ejercicio_id, ejercicio_usado_id, n_serie, peso, reps")
        .eq("registro_id", registro.id)
    : { data: [] };

  const ejercicioIds = new Set<string>();
  for (const b of bloques ?? []) {
    for (const be of b.bloque_ejercicios) {
      if (!be.registra_carga) continue;
      ejercicioIds.add(be.ejercicio.id);
      if (be.alternativa) ejercicioIds.add(be.alternativa.id);
    }
  }

  // "La última vez": por ejercicio realmente usado, de registros anteriores del alumno.
  const ultimaPorEjercicio = new Map<string, string>();
  if (modo === "editar" && ejercicioIds.size) {
    let consulta = supabase
      .from("registros_series")
      .select("registro_id, ejercicio_usado_id, peso, created_at")
      .in("ejercicio_usado_id", [...ejercicioIds])
      .not("peso", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (registro) consulta = consulta.neq("registro_id", registro.id);
    const { data: previas } = await consulta;

    const registroDe = new Map<string, string>();
    const pesos = new Map<string, number[]>();
    for (const p of previas ?? []) {
      if (!registroDe.has(p.ejercicio_usado_id)) registroDe.set(p.ejercicio_usado_id, p.registro_id);
      if (registroDe.get(p.ejercicio_usado_id) === p.registro_id && p.peso !== null) {
        pesos.set(p.ejercicio_usado_id, [...(pesos.get(p.ejercicio_usado_id) ?? []), Number(p.peso)]);
      }
    }
    for (const [id, lista] of pesos) {
      const min = Math.min(...lista);
      const max = Math.max(...lista);
      ultimaPorEjercicio.set(id, min === max ? `${fmt(max)} kg` : `${fmt(min)} a ${fmt(max)} kg`);
    }
  }

  const items: ItemVista[] = [];
  for (const b of bloques ?? []) {
    const ordenados = [...b.bloque_ejercicios].sort((x, y) => x.orden - y.orden);
    for (const be of ordenados) {
      const filas = (guardadas ?? [])
        .filter((g) => g.bloque_ejercicio_id === be.id)
        .sort((x, y) => x.n_serie - y.n_serie);
      const nSeries = Math.max(cantidadSeries(be.series), ...filas.map((f) => f.n_serie));
      const series = Array.from({ length: nSeries }, (_, i) => {
        const fila = filas.find((f) => f.n_serie === i + 1);
        return {
          peso: fila?.peso != null ? fmt(Number(fila.peso)) : "",
          reps: fila?.reps != null ? String(fila.reps) : "",
        };
      });
      const ultima: Record<string, string | null> = {};
      for (const e of [be.ejercicio, be.alternativa]) {
        if (e) ultima[e.id] = ultimaPorEjercicio.get(e.id) ?? null;
      }
      items.push({
        beId: be.id,
        bloqueNombre: b.nombre,
        bloqueIndicacion: b.indicacion,
        series: be.series,
        reps: be.reps,
        cargaSugerida: be.carga_sugerida,
        nota: be.nota,
        registraCarga: be.registra_carga,
        ejercicio: vistaEjercicio(be.ejercicio),
        alternativa: be.alternativa ? vistaEjercicio(be.alternativa) : null,
        nSeries,
        guardado: { ejercicioUsadoId: filas[0]?.ejercicio_usado_id ?? null, series },
        ultima,
      });
    }
  }

  const vista: EntrenamientoVista = {
    sesionId,
    asignacionId: asignacion.id,
    semana: sesion.semana,
    estimulo: sesion.estimulo,
    modo,
    items,
  };

  return <Entrenamiento vista={vista} />;
}
