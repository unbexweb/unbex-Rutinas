"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EstadoForm } from "@/lib/auth/validar";

export async function cambiarContrasena(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const password = String(formData.get("password") ?? "");
  const repetir = String(formData.get("repetir") ?? "");

  if (password.length < 8) {
    return { errores: { password: "La contraseña tiene que tener al menos 8 caracteres" } };
  }
  if (password !== repetir) return { errores: { repetir: "Las contraseñas no coinciden" } };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "No pudimos cambiar la contraseña. Pedí un nuevo mail de recuperación." };
  }

  redirect("/");
}
