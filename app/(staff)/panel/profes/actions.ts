"use server";

import type { EstadoAlta } from "@/components/staff/FormAlta";
import { texto } from "@/lib/auth/validar";
import { createClient } from "@/lib/supabase/server";
import { SIN_PERMISO, verificarAdmin } from "@/lib/staff/auth";
import { crearUsuario } from "@/lib/staff/crear-usuario";
import type { ResultadoStaff } from "@/lib/staff/tipos";

export async function altaProfe(_prev: EstadoAlta, formData: FormData): Promise<EstadoAlta> {
  const llamador = await verificarAdmin();
  if (!llamador) return { error: SIN_PERMISO };

  const valores = {
    nombre: texto(formData, "nombre"),
    apellido: texto(formData, "apellido"),
    dni: texto(formData, "dni"),
    email: texto(formData, "email"),
  };

  const res = await crearUsuario(llamador, { rol: "profe", ...valores });
  if (!res.ok) return { error: res.error, errores: res.errores, valores };

  return {
    credenciales: {
      nombre: `${valores.nombre} ${valores.apellido}`,
      email: valores.email.toLowerCase(),
      password: res.password,
    },
  };
}

export async function cambiarEstadoProfe(profeId: string, estado: "activo" | "inactivo"): Promise<ResultadoStaff> {
  const llamador = await verificarAdmin();
  if (!llamador || (estado !== "activo" && estado !== "inactivo")) return { ok: false, error: SIN_PERMISO };
  if (profeId === llamador.profile.id) return { ok: false, error: "No podés desactivar tu propia cuenta." };

  // Solo profes (no otros admins). RLS acota al gym; el admin puede editar perfiles de staff.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ estado })
    .eq("id", profeId)
    .eq("rol", "profe")
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos cambiar el estado." };
  return { ok: true };
}
