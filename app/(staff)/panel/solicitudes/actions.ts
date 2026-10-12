"use server";

import { createClient } from "@/lib/supabase/server";
import { SIN_PERMISO, verificarStaff } from "@/lib/staff/auth";
import { mensajeDe } from "@/lib/staff/errores";
import type { ResultadoStaff } from "@/lib/staff/tipos";

export async function atenderSolicitud(solicitudId: string, planId: string): Promise<ResultadoStaff> {
  if (!(await verificarStaff())) return { ok: false, error: SIN_PERMISO };
  const supabase = await createClient();
  const { error } = await supabase.rpc("atender_solicitud", {
    p_solicitud_id: solicitudId,
    p_plan_id: planId,
  });
  if (error) return { ok: false, error: mensajeDe(error, "No pudimos atender la solicitud.") };
  return { ok: true };
}
