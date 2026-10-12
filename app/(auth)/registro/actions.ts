"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esDni, esEmail, soloDigitos, texto, type EstadoForm } from "@/lib/auth/validar";

export async function registrarse(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const nombre = texto(formData, "nombre");
  const apellido = texto(formData, "apellido");
  const dni = soloDigitos(texto(formData, "dni"));
  const email = texto(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const valores = { nombre, apellido, dni, email };

  const errores: Record<string, string> = {};
  if (!nombre) errores.nombre = "Ingresá tu nombre";
  if (!apellido) errores.apellido = "Ingresá tu apellido";
  if (!esDni(dni)) errores.dni = "El DNI tiene que tener 7 u 8 números";
  if (!esEmail(email)) errores.email = "Ingresá un email válido";
  if (password.length < 8) errores.password = "La contraseña tiene que tener al menos 8 caracteres";
  if (Object.keys(errores).length) return { errores, valores };

  // El gimnasio lo define el servidor (GYM_SLUG), nunca el cliente.
  const admin = createAdminClient();
  const { data: gym } = await admin
    .from("gyms")
    .select("id")
    .eq("slug", process.env.GYM_SLUG ?? "")
    .maybeSingle();
  if (!gym) return { error: "No pudimos crear tu cuenta. Probá de nuevo en un rato.", valores };

  const { data: porDni } = await admin.from("profiles").select("id").eq("dni", dni).maybeSingle();
  if (porDni) return { errores: { dni: "Ya hay una cuenta con ese DNI" }, valores };

  const { data: porEmail } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (porEmail) return { errores: { email: "Ya hay una cuenta con ese email" }, valores };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre, apellido, dni, gym_id: gym.id } },
  });
  if (error) {
    return { error: "No pudimos crear tu cuenta. Revisá los datos e intentá de nuevo.", valores };
  }

  // Si el proyecto exige confirmar el mail, no hay sesión todavía.
  if (!data.session) {
    return { ok: "Te mandamos un mail para confirmar tu cuenta. Después vas a poder entrar.", valores };
  }

  redirect("/pendiente");
}
