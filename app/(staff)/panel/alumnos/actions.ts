"use server";

import type { EstadoAlta } from "@/components/staff/FormAlta";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/auth/validar";
import { SIN_PERMISO, verificarStaff } from "@/lib/staff/auth";
import { crearUsuario } from "@/lib/staff/crear-usuario";
import { mensajeDe } from "@/lib/staff/errores";
import type { ResultadoStaff } from "@/lib/staff/tipos";
import { restablecerPassword, type ResultadoRestablecer } from "@/lib/staff/restablecer-password";

export async function restablecerPasswordAlumno(alumnoId: string): Promise<ResultadoRestablecer> {
  const llamador = await verificarStaff();
  if (!llamador) return { ok: false, error: SIN_PERMISO };
  return restablecerPassword(llamador, alumnoId);
}


export async function altaAlumno(_prev: EstadoAlta, formData: FormData): Promise<EstadoAlta> {
  const llamador = await verificarStaff();
  if (!llamador) return { error: SIN_PERMISO };

  const valores = {
    nombre: texto(formData, "nombre"),
    apellido: texto(formData, "apellido"),
    dni: texto(formData, "dni"),
    email: texto(formData, "email"),
  };

  const res = await crearUsuario(llamador, { rol: "alumno", ...valores });
  if (!res.ok) return { error: res.error, errores: res.errores, valores };

  // La contraseña temporal se devuelve una sola vez y no se guarda en ningún lado.
  return {
    credenciales: {
      nombre: `${valores.nombre} ${valores.apellido}`,
      email: valores.email.toLowerCase(),
      password: res.password,
    },
  };
}

const ESTADOS = ["pendiente", "activo", "inactivo"] as const;

export async function cambiarEstadoAlumno(
  alumnoId: string,
  estado: (typeof ESTADOS)[number],
): Promise<ResultadoStaff> {
  if (!(await verificarStaff()) || !ESTADOS.includes(estado)) return { ok: false, error: SIN_PERMISO };

  // Con el cliente normal: RLS limita al staff a alumnos de su gym.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ estado })
    .eq("id", alumnoId)
    .eq("rol", "alumno")
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos cambiar el estado." };
  return { ok: true };
}

export async function asignarPlan(alumnoId: string, planId: string): Promise<ResultadoStaff> {
  if (!(await verificarStaff())) return { ok: false, error: SIN_PERMISO };
  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_plan", { p_alumno_id: alumnoId, p_plan_id: planId });
  if (error) return { ok: false, error: mensajeDe(error, "No pudimos asignar el plan.") };
  return { ok: true };
}

export async function personalizarPlan(alumnoId: string, planId: string): Promise<ResultadoStaff> {
  if (!(await verificarStaff())) return { ok: false, error: SIN_PERMISO };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("personalizar_plan", {
    p_alumno_id: alumnoId,
    p_plan_id: planId,
  });
  if (error || !data) return { ok: false, error: mensajeDe(error, "No pudimos personalizar el plan.") };
  return { ok: true, irA: `/panel/planes/${data}` };
}
