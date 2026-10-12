"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  BloqueEditor,
  CambiosEjercicio,
  EjercicioDeBloque,
  Resultado,
} from "@/lib/staff/editor-tipos";
import { SIN_PERMISO, verificarStaff } from "@/lib/staff/auth";
import { mensajeDe } from "@/lib/staff/errores";

// Todas editan EN EL LUGAR (UPDATE), nunca borran y reinsertan: ver "Nota para el editor de planes" en docs/RLS.md.
// Usan el cliente con sesión del usuario, así RLS sigue filtrando por gym.

const ERROR = "No pudimos guardar el cambio.";
const sinPermiso = { ok: false, error: SIN_PERMISO } as const;
const falla = (error = ERROR) => ({ ok: false, error }) as const;

const LIMITES = { series: 40, reps: 60, carga_sugerida: 80, nota: 500 } as const;

function recortar(valor: string | null | undefined, max: number): string | null {
  const v = (valor ?? "").trim().slice(0, max);
  return v || null;
}

// ---------------------------------------------------------------- plan
export async function actualizarPlan(
  planId: string,
  cambios: { nombre: string; tipo: string; nivel: string },
): Promise<Resultado<null>> {
  if (!(await verificarStaff())) return sinPermiso;
  const nombre = cambios.nombre.trim();
  const tipo = cambios.tipo.trim();
  if (!nombre || !tipo) return falla("El nombre y el tipo no pueden quedar vacíos.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planes")
    .update({ nombre, tipo, nivel: cambios.nivel.trim() || null })
    .eq("id", planId)
    .select("id");
  if (error || !data?.length) return falla();
  return { ok: true, data: null };
}

// ---------------------------------------------------------------- bloques
export async function agregarBloque(sesionId: string): Promise<Resultado<BloqueEditor>> {
  if (!(await verificarStaff())) return sinPermiso;
  const supabase = await createClient();

  const { data: existentes } = await supabase.from("bloques").select("orden").eq("sesion_id", sesionId);
  const orden = Math.max(0, ...(existentes ?? []).map((b) => b.orden)) + 1;

  const { data, error } = await supabase
    .from("bloques")
    .insert({ sesion_id: sesionId, orden, nombre: `Bloque ${(existentes?.length ?? 0) + 1}` })
    .select("id, orden, nombre, indicacion")
    .single();
  if (error || !data) return falla("No pudimos agregar el bloque.");
  return { ok: true, data: { ...data, ejercicios: [] } };
}

export async function actualizarBloque(
  bloqueId: string,
  cambios: { nombre?: string; indicacion?: string | null },
): Promise<Resultado<null>> {
  if (!(await verificarStaff())) return sinPermiso;
  const patch: { nombre?: string; indicacion?: string | null } = {};
  if (cambios.nombre !== undefined) {
    const nombre = cambios.nombre.trim().slice(0, 120);
    if (!nombre) return falla("El bloque necesita un nombre.");
    patch.nombre = nombre;
  }
  if (cambios.indicacion !== undefined) patch.indicacion = recortar(cambios.indicacion, 500);

  const supabase = await createClient();
  const { data, error } = await supabase.from("bloques").update(patch).eq("id", bloqueId).select("id");
  if (error || !data?.length) return falla();
  return { ok: true, data: null };
}

export async function eliminarBloque(bloqueId: string): Promise<Resultado<null>> {
  if (!(await verificarStaff())) return sinPermiso;
  const supabase = await createClient();
  const { data, error } = await supabase.from("bloques").delete().eq("id", bloqueId).select("id");
  if (error || !data?.length) return falla("No pudimos quitar el bloque.");
  return { ok: true, data: null };
}

export async function moverBloque(bloqueId: string, dir: "arriba" | "abajo"): Promise<Resultado<null>> {
  if (!(await verificarStaff())) return sinPermiso;
  const supabase = await createClient();

  const { data: bloque } = await supabase.from("bloques").select("sesion_id").eq("id", bloqueId).maybeSingle();
  if (!bloque) return falla();
  const { data: hermanos } = await supabase
    .from("bloques")
    .select("id, orden")
    .eq("sesion_id", bloque.sesion_id)
    .order("orden")
    .order("created_at")
    .order("id");
  if (!hermanos) return falla();

  const ids = hermanos.map((h) => h.id);
  const i = ids.indexOf(bloqueId);
  const j = dir === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true, data: null };
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];

  for (const [pos, id] of ids.entries()) {
    const actual = hermanos.find((h) => h.id === id)!;
    if (actual.orden === pos + 1) continue;
    const { error } = await supabase.from("bloques").update({ orden: pos + 1 }).eq("id", id);
    if (error) return falla("No pudimos reordenar.");
  }
  return { ok: true, data: null };
}

// ---------------------------------------------------------------- ejercicios dentro de un bloque
const COLUMNAS_EJ =
  "id, orden, ejercicio_id, alternativa_id, series, reps, carga_sugerida, registra_carga, nota";

export async function agregarEjercicio(
  bloqueId: string,
  ejercicioId: string,
): Promise<Resultado<EjercicioDeBloque>> {
  if (!(await verificarStaff())) return sinPermiso;
  const supabase = await createClient();

  const { data: existentes } = await supabase.from("bloque_ejercicios").select("orden").eq("bloque_id", bloqueId);
  const orden = Math.max(0, ...(existentes ?? []).map((b) => b.orden)) + 1;

  const { data, error } = await supabase
    .from("bloque_ejercicios")
    .insert({ bloque_id: bloqueId, ejercicio_id: ejercicioId, orden, registra_carga: true })
    .select(COLUMNAS_EJ)
    .single();
  if (error || !data) return falla("No pudimos agregar el ejercicio.");
  return { ok: true, data };
}

export async function actualizarEjercicio(beId: string, cambios: CambiosEjercicio): Promise<Resultado<null>> {
  if (!(await verificarStaff())) return sinPermiso;

  const patch: CambiosEjercicio = {};
  if (cambios.ejercicio_id !== undefined) patch.ejercicio_id = cambios.ejercicio_id;
  if (cambios.alternativa_id !== undefined) patch.alternativa_id = cambios.alternativa_id;
  if (cambios.registra_carga !== undefined) patch.registra_carga = Boolean(cambios.registra_carga);
  if (cambios.series !== undefined) patch.series = recortar(cambios.series, LIMITES.series);
  if (cambios.reps !== undefined) patch.reps = recortar(cambios.reps, LIMITES.reps);
  if (cambios.carga_sugerida !== undefined) patch.carga_sugerida = recortar(cambios.carga_sugerida, LIMITES.carga_sugerida);
  if (cambios.nota !== undefined) patch.nota = recortar(cambios.nota, LIMITES.nota);

  const supabase = await createClient();
  const { data, error } = await supabase.from("bloque_ejercicios").update(patch).eq("id", beId).select("id");
  if (error || !data?.length) return falla();
  return { ok: true, data: null };
}

export async function eliminarEjercicio(beId: string): Promise<Resultado<null>> {
  if (!(await verificarStaff())) return sinPermiso;
  const supabase = await createClient();
  const { data, error } = await supabase.from("bloque_ejercicios").delete().eq("id", beId).select("id");
  if (error || !data?.length) return falla("No pudimos quitar el ejercicio.");
  return { ok: true, data: null };
}

export async function moverEjercicio(beId: string, dir: "arriba" | "abajo"): Promise<Resultado<null>> {
  if (!(await verificarStaff())) return sinPermiso;
  const supabase = await createClient();

  const { data: fila } = await supabase.from("bloque_ejercicios").select("bloque_id").eq("id", beId).maybeSingle();
  if (!fila) return falla();
  const { data: hermanos } = await supabase
    .from("bloque_ejercicios")
    .select("id, orden")
    .eq("bloque_id", fila.bloque_id)
    .order("orden")
    .order("created_at")
    .order("id");
  if (!hermanos) return falla();

  const ids = hermanos.map((h) => h.id);
  const i = ids.indexOf(beId);
  const j = dir === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true, data: null };
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];

  for (const [pos, id] of ids.entries()) {
    const actual = hermanos.find((h) => h.id === id)!;
    if (actual.orden === pos + 1) continue;
    const { error } = await supabase.from("bloque_ejercicios").update({ orden: pos + 1 }).eq("id", id);
    if (error) return falla("No pudimos reordenar.");
  }
  return { ok: true, data: null };
}

// ---------------------------------------------------------------- semanas
export async function copiarSemana(
  planId: string,
  origen: number,
  destino: number,
): Promise<Resultado<{ bloques: number }>> {
  if (!(await verificarStaff())) return sinPermiso;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copiar_semana", {
    p_plan_id: planId,
    p_semana_origen: origen,
    p_semana_destino: destino,
  });
  if (error) return falla(mensajeDe(error, "No pudimos copiar la semana."));
  return { ok: true, data: { bloques: data ?? 0 } };
}
