"use server";

import { revalidatePath } from "next/cache";
import type { ResultadoAccion } from "@/lib/alumno/entrenar-tipos";
import { createClient } from "@/lib/supabase/server";

type Contexto = { asignacionId: string; sesionId: string; beId: string };

type EntradaSerie = Contexto & {
  ejercicioUsadoId: string;
  nSerie: number;
  // Cuántas series tiene el ejercicio: queda hecho cuando todas están tildadas.
  totalSeries: number;
  peso: string;
  reps: string;
  hecha: boolean;
};

const PESO = /^\d{1,5}([.,]\d{1,2})?$/;
const REPS = /^\d{1,4}$/;

const ERROR_GENERICO = "No pudimos guardar. Revisá tu conexión y probá de nuevo.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Plan libre: se puede registrar cualquier entrenamiento de la asignación activa que todavía no esté terminado.
// RLS controla el resto. Devuelve el id del registro de la sesión (lo crea si todavía no existe).
async function registroEditable(
  supabase: Supabase,
  { asignacionId, sesionId }: Pick<Contexto, "asignacionId" | "sesionId">,
): Promise<{ ok: true; registroId: string } | { ok: false; error: string }> {
  const { data: asignacion } = await supabase
    .from("asignaciones")
    .select("estado, plan_id")
    .eq("id", asignacionId)
    .maybeSingle();
  const { data: sesion } = await supabase.from("sesiones").select("plan_id").eq("id", sesionId).maybeSingle();
  if (!asignacion || !sesion || asignacion.estado !== "activa" || sesion.plan_id !== asignacion.plan_id) {
    return { ok: false, error: "Ese entrenamiento no se puede editar." };
  }

  const { data: existente } = await supabase
    .from("registros_sesion")
    .select("id, completada")
    .eq("asignacion_id", asignacionId)
    .eq("sesion_id", sesionId)
    .maybeSingle();
  if (existente?.completada) return { ok: false, error: "Ese entrenamiento ya está hecho." };
  if (existente) return { ok: true, registroId: existente.id };

  const { error: errRegistro } = await supabase
    .from("registros_sesion")
    .upsert(
      { asignacion_id: asignacionId, sesion_id: sesionId },
      { onConflict: "asignacion_id,sesion_id", ignoreDuplicates: true },
    );
  if (errRegistro) return { ok: false, error: ERROR_GENERICO };

  const { data: registro } = await supabase
    .from("registros_sesion")
    .select("id")
    .eq("asignacion_id", asignacionId)
    .eq("sesion_id", sesionId)
    .single();
  return registro ? { ok: true, registroId: registro.id } : { ok: false, error: ERROR_GENERICO };
}

async function marcar(supabase: Supabase, registroId: string, beId: string, hecho: boolean) {
  return supabase
    .from("registros_ejercicios")
    .upsert(
      { registro_id: registroId, bloque_ejercicio_id: beId, hecho },
      { onConflict: "registro_id,bloque_ejercicio_id" },
    );
}

// Cada tilde (o cada cambio en una serie ya tildada) guarda esa serie. Si todas las series del ejercicio
// quedan tildadas, el ejercicio queda hecho; si se destilda alguna, deja de estarlo.
export async function guardarSerie(entrada: EntradaSerie): Promise<ResultadoAccion & { ejercicioHecho?: boolean }> {
  const { beId, ejercicioUsadoId, nSerie, totalSeries } = entrada;
  if (!Number.isInteger(nSerie) || nSerie < 1 || nSerie > 20 || totalSeries < 1 || totalSeries > 20) {
    return { ok: false, error: ERROR_GENERICO };
  }
  const peso = entrada.peso.trim();
  const reps = entrada.reps.trim();
  if ((peso && !PESO.test(peso)) || (reps && !REPS.test(reps))) {
    return { ok: false, error: `Revisá los números de la serie ${nSerie}.` };
  }

  try {
    const supabase = await createClient();
    const ctx = await registroEditable(supabase, entrada);
    if (!ctx.ok) return ctx;

    const { error } = await supabase.from("registros_series").upsert(
      {
        registro_id: ctx.registroId,
        bloque_ejercicio_id: beId,
        ejercicio_usado_id: ejercicioUsadoId,
        n_serie: nSerie,
        peso: peso ? Number(peso.replace(",", ".")) : null,
        reps: reps ? Number(reps) : null,
        hecha: entrada.hecha,
      },
      { onConflict: "registro_id,bloque_ejercicio_id,n_serie" },
    );
    if (error) return { ok: false, error: ERROR_GENERICO };

    const { count } = await supabase
      .from("registros_series")
      .select("id", { count: "exact", head: true })
      .eq("registro_id", ctx.registroId)
      .eq("bloque_ejercicio_id", beId)
      .eq("hecha", true)
      .lte("n_serie", totalSeries);
    const ejercicioHecho = (count ?? 0) >= totalSeries;

    const { error: errMarca } = await marcar(supabase, ctx.registroId, beId, ejercicioHecho);
    if (errMarca) return { ok: false, error: ERROR_GENERICO };

    return { ok: true, ejercicioHecho };
  } catch {
    return { ok: false, error: ERROR_GENERICO };
  }
}

// Ejercicios que no registran carga: un toque los marca o desmarca.
export async function marcarEjercicio(entrada: Contexto & { hecho: boolean }): Promise<ResultadoAccion> {
  try {
    const supabase = await createClient();
    const ctx = await registroEditable(supabase, entrada);
    if (!ctx.ok) return ctx;
    const { error } = await marcar(supabase, ctx.registroId, entrada.beId, entrada.hecho);
    return error ? { ok: false, error: ERROR_GENERICO } : { ok: true };
  } catch {
    return { ok: false, error: ERROR_GENERICO };
  }
}

export async function terminarEntrenamiento(
  asignacionId: string,
  sesionId: string,
): Promise<ResultadoAccion> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("completar_sesion", {
      p_asignacion_id: asignacionId,
      p_sesion_id: sesionId,
    });
    if (error) {
      return {
        ok: false,
        error: error.code === "22023" ? error.message : "No pudimos cerrar el entrenamiento. Probá de nuevo.",
      };
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "No pudimos cerrar el entrenamiento. Probá de nuevo." };
  }
}
