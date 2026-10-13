"use server";

import { revalidatePath } from "next/cache";
import { posicion } from "@/lib/alumno/datos";
import type { ResultadoAccion, SerieVista } from "@/lib/alumno/entrenar-tipos";
import { createClient } from "@/lib/supabase/server";

type Contexto = { asignacionId: string; sesionId: string; beId: string };

type EntradaGuardar = Contexto & {
  ejercicioUsadoId: string;
  series: SerieVista[];
  // true en "Listo" (queda con ✓); false cuando solo se guarda lo escrito al pasar a otro ejercicio.
  marcarHecho: boolean;
};

const PESO = /^\d{1,5}([.,]\d{1,2})?$/;
const REPS = /^\d{1,4}$/;

const ERROR_GENERICO = "No pudimos guardar. Revisá tu conexión y probá de nuevo.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Solo se registra el entrenamiento que le toca. RLS controla el resto.
// Devuelve el id del registro de la sesión (lo crea si todavía no existe).
async function registroEditable(
  supabase: Supabase,
  { asignacionId, sesionId }: Pick<Contexto, "asignacionId" | "sesionId">,
): Promise<{ ok: true; registroId: string } | { ok: false; error: string }> {
  const { data: asignacion } = await supabase
    .from("asignaciones")
    .select("estado, plan_id, semana_actual, estimulo_actual")
    .eq("id", asignacionId)
    .maybeSingle();
  const { data: sesion } = await supabase
    .from("sesiones")
    .select("plan_id, semana, estimulo")
    .eq("id", sesionId)
    .maybeSingle();
  if (
    !asignacion ||
    !sesion ||
    asignacion.estado !== "activa" ||
    sesion.plan_id !== asignacion.plan_id ||
    posicion(sesion.semana, sesion.estimulo) !== posicion(asignacion.semana_actual, asignacion.estimulo_actual)
  ) {
    return { ok: false, error: "Ese no es el entrenamiento que te toca." };
  }

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

export async function guardarEjercicio(entrada: EntradaGuardar): Promise<ResultadoAccion> {
  const { beId, ejercicioUsadoId } = entrada;
  if (entrada.series.length > 20) return { ok: false, error: ERROR_GENERICO };

  // Validar y normalizar lo escrito.
  const llenas: { n_serie: number; peso: number | null; reps: number | null }[] = [];
  const vacias: number[] = [];
  for (const [i, s] of entrada.series.entries()) {
    const peso = s.peso.trim();
    const reps = s.reps.trim();
    if (!peso && !reps) {
      vacias.push(i + 1);
      continue;
    }
    if ((peso && !PESO.test(peso)) || (reps && !REPS.test(reps))) {
      return { ok: false, error: `Revisá los números de la serie ${i + 1}.` };
    }
    llenas.push({
      n_serie: i + 1,
      peso: peso ? Number(peso.replace(",", ".")) : null,
      reps: reps ? Number(reps) : null,
    });
  }

  try {
    const supabase = await createClient();
    const ctx = await registroEditable(supabase, entrada);
    if (!ctx.ok) return ctx;

    if (llenas.length) {
      const { error } = await supabase.from("registros_series").upsert(
        llenas.map((s) => ({
          registro_id: ctx.registroId,
          bloque_ejercicio_id: beId,
          ejercicio_usado_id: ejercicioUsadoId,
          ...s,
        })),
        { onConflict: "registro_id,bloque_ejercicio_id,n_serie" },
      );
      if (error) return { ok: false, error: ERROR_GENERICO };
    }

    // Si borró lo que había escrito en una serie, se vacía también en la base.
    if (vacias.length) {
      const { error } = await supabase
        .from("registros_series")
        .update({ peso: null, reps: null, ejercicio_usado_id: ejercicioUsadoId })
        .eq("registro_id", ctx.registroId)
        .eq("bloque_ejercicio_id", beId)
        .in("n_serie", vacias);
      if (error) return { ok: false, error: ERROR_GENERICO };
    }

    if (entrada.marcarHecho) {
      const { error } = await marcar(supabase, ctx.registroId, beId, true);
      if (error) return { ok: false, error: ERROR_GENERICO };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: ERROR_GENERICO };
  }
}

// Ejercicios que no registran carga (movilidad, activación): un toque los marca o desmarca.
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
