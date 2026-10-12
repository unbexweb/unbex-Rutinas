"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolverEmail } from "@/lib/auth/resolver-email";
import { MENSAJE_LOGIN, texto, type EstadoForm } from "@/lib/auth/validar";

export async function iniciarSesion(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const identificador = texto(formData, "identificador");
  const password = String(formData.get("password") ?? "");
  const valores = { identificador };

  if (!identificador || !password) return { error: MENSAJE_LOGIN, valores };

  // Cualquier fallo (DNI inexistente, contraseña mal) da el mismo mensaje.
  const email = await resolverEmail(identificador);
  if (!email) return { error: MENSAJE_LOGIN, valores };

  // Cliente de servidor con cookies, nunca el admin.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: MENSAJE_LOGIN, valores };

  redirect("/");
}
