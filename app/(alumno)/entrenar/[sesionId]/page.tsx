import { notFound } from "next/navigation";
import type {
  EjercicioVista,
  EntrenamientoVista,
  ItemVista,
  SerieAnterior,
} from "@/lib/alumno/entrenar-tipos";
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

  const { data: bloques } = await supabase
    .from("bloques")
    .select(
      `id, orden, nombre, indicacion,
       bloque_ejercicios (
         id, orden, grupo, series, reps, carga_sugerida, registra_carga, nota,
         ejercicio:ejercicios!bloque_ejercicios_ejercicio_id_fkey (${EJERCICIO}),
         alternativa:ejercicios!bloque_ejercicios_alternativa_id_fkey (${EJERCICIO})
       )`,
    )
    .eq("sesion_id", sesionId)
    .order("orden");

  const { data: registro } = await supabase
    .from("registros_sesion")
    .select("id, completada")
    .eq("asignacion_id", asignacion.id)
    .eq("sesion_id", sesionId)
    .maybeSingle();

  // Plan libre: se edita cualquier entrenamiento que todavía no se terminó (mientras la asignación esté activa).
  const modo: EntrenamientoVista["modo"] =
    asignacion.estado === "activa" && !registro?.completada ? "editar" : "leer";

  const { data: guardadas } = registro
    ? await supabase
        .from("registros_series")
        .select("bloque_ejercicio_id, ejercicio_usado_id, n_serie, peso, reps, hecha")
        .eq("registro_id", registro.id)
    : { data: [] };

  const { data: marcados } = registro
    ? await supabase.from("registros_ejercicios").select("bloque_ejercicio_id, hecho").eq("registro_id", registro.id)
    : { data: [] };

  const ejercicioIds = new Set<string>();
  for (const b of bloques ?? []) {
    for (const be of b.bloque_ejercicios) {
      if (!be.registra_carga) continue;
      ejercicioIds.add(be.ejercicio.id);
      if (be.alternativa) ejercicioIds.add(be.alternativa.id);
    }
  }

  // "Anterior": las series de la última vez que hizo ese mismo ejercicio (el realmente usado).
  const anteriorPorEjercicio = new Map<string, SerieAnterior[]>();
  if (modo === "editar" && ejercicioIds.size) {
    let consulta = supabase
      .from("registros_series")
      .select("registro_id, ejercicio_usado_id, n_serie, peso, reps, created_at")
      .in("ejercicio_usado_id", [...ejercicioIds])
      .or("peso.not.is.null,reps.not.is.null")
      .order("created_at", { ascending: false })
      .limit(1500);
    if (registro) consulta = consulta.neq("registro_id", registro.id);
    const { data: previas } = await consulta;

    const registroDe = new Map<string, string>();
    for (const p of previas ?? []) {
      if (!registroDe.has(p.ejercicio_usado_id)) registroDe.set(p.ejercicio_usado_id, p.registro_id);
      if (registroDe.get(p.ejercicio_usado_id) !== p.registro_id) continue;
      const lista = anteriorPorEjercicio.get(p.ejercicio_usado_id) ?? [];
      while (lista.length < p.n_serie) lista.push({ peso: "", reps: "" });
      lista[p.n_serie - 1] = {
        peso: p.peso !== null ? fmt(Number(p.peso)) : "",
        reps: p.reps !== null ? String(p.reps) : "",
      };
      anteriorPorEjercicio.set(p.ejercicio_usado_id, lista);
    }
  }

  const items: ItemVista[] = [];
  for (const b of bloques ?? []) {
    const ordenados = [...b.bloque_ejercicios].sort((x, y) => x.orden - y.orden);

    // Super series (2 o más ejercicios con el mismo grupo en el bloque): las rondas son el mayor número de series del grupo.
    const grupos = new Map<string, { cantidad: number; rondas: number }>();
    for (const be of ordenados) {
      if (!be.grupo) continue;
      const g = grupos.get(be.grupo) ?? { cantidad: 0, rondas: 0 };
      g.cantidad += 1;
      if (be.registra_carga) {
        const propias = (guardadas ?? []).filter((x) => x.bloque_ejercicio_id === be.id).map((x) => x.n_serie);
        g.rondas = Math.max(g.rondas, cantidadSeries(be.series), ...propias);
      }
      grupos.set(be.grupo, g);
    }

    for (const be of ordenados) {
      const filas = (guardadas ?? [])
        .filter((g) => g.bloque_ejercicio_id === be.id)
        .sort((x, y) => x.n_serie - y.n_serie);
      const grupo = be.grupo ? grupos.get(be.grupo) : undefined;
      const enSuper = Boolean(grupo && grupo.cantidad >= 2);
      const rondas = grupo?.rondas || 3;
      const propias = parseInt(be.series ?? "", 10);
      // Con carga: sus series. Sin carga dentro de una super serie: participa en cada ronda (solo se tilda).
      // Sin carga y suelto: no tiene series.
      const nSeries = be.registra_carga
        ? Math.max(cantidadSeries(be.series), ...filas.map((f) => f.n_serie))
        : enSuper
          ? Math.min(20, Math.max(Number.isFinite(propias) && propias > 0 ? propias : rondas, ...filas.map((f) => f.n_serie)))
          : 0;
      const series = Array.from({ length: nSeries }, (_, i) => {
        const fila = filas.find((f) => f.n_serie === i + 1);
        return {
          peso: fila?.peso != null ? fmt(Number(fila.peso)) : "",
          reps: fila?.reps != null ? String(fila.reps) : "",
          hecha: Boolean(fila?.hecha),
        };
      });
      const marca = (marcados ?? []).find((m) => m.bloque_ejercicio_id === be.id);
      // Con carga: hecho cuando todas las series están tildadas (o quedó marcado con el diseño anterior).
      const hecho =
        be.registra_carga || enSuper
          ? (series.length > 0 && series.every((s) => s.hecha)) || (be.registra_carga && Boolean(marca?.hecho))
          : Boolean(marca?.hecho);
      const anterior: Record<string, SerieAnterior[]> = {};
      for (const e of [be.ejercicio, be.alternativa]) {
        const previa = e ? anteriorPorEjercicio.get(e.id) : undefined;
        if (e && previa) anterior[e.id] = previa;
      }
      items.push({
        beId: be.id,
        bloqueId: b.id,
        bloqueNombre: b.nombre,
        bloqueIndicacion: b.indicacion,
        grupo: be.grupo,
        series: be.series,
        reps: be.reps,
        cargaSugerida: be.carga_sugerida,
        nota: be.nota,
        registraCarga: be.registra_carga,
        ejercicio: vistaEjercicio(be.ejercicio),
        alternativa: be.alternativa ? vistaEjercicio(be.alternativa) : null,
        nSeries,
        guardado: { ejercicioUsadoId: filas[0]?.ejercicio_usado_id ?? null, series, hecho },
        anterior,
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
