import "server-only";
import type { Usuario } from "@/lib/auth/usuario";
import { SIN_PERMISO } from "@/lib/staff/auth";
import { generarPasswordTemporal } from "@/lib/staff/crear-usuario";
import { createAdminClient } from "@/lib/supabase/admin";

export type ResultadoRestablecer =
  | { ok: true; nombre: string; email: string; password: string }
  | { ok: false; error: string };

// Usa el cliente admin: verifica que el llamador sea staff activo y que el objetivo sea del MISMO gym.
// Alumnos: cualquier staff. Profes: solo admin. Nunca admins ni la propia cuenta.
export async function restablecerPassword(llamador: Usuario, objetivoId: string): Promise<ResultadoRestablecer> {
  const { rol, estado, gym_id } = llamador.profile;
  if (estado !== "activo" || (rol !== "admin" && rol !== "profe") || objetivoId === llamador.profile.id) {
    return { ok: false, error: SIN_PERMISO };
  }

  const admin = createAdminClient();
  const { data: objetivo } = await admin
    .from("profiles")
    .select("id, rol, gym_id, nombre, apellido, email")
    .eq("id", objetivoId)
    .maybeSingle();

  const permitido =
    objetivo?.gym_id === gym_id &&
    (objetivo.rol === "alumno" || (objetivo.rol === "profe" && rol === "admin"));
  if (!objetivo || !permitido) return { ok: false, error: SIN_PERMISO };

  const password = generarPasswordTemporal();
  const { error } = await admin.auth.admin.updateUserById(objetivo.id, { password });
  if (error) return { ok: false, error: "No pudimos restablecer la contraseña. Probá de nuevo." };

  return { ok: true, nombre: `${objetivo.nombre} ${objetivo.apellido}`, email: objetivo.email, password };
}
