"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolverEmail } from "@/lib/auth/resolver-email";
import { texto, type EstadoForm } from "@/lib/auth/validar";

const RESPUESTA = "Si la cuenta existe, te mandamos un mail para cambiar la contraseña.";

export async function pedirRecuperacion(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const identificador = texto(formData, "identificador");
  if (!identificador) return { errores: { identificador: "Ingresá tu email o DNI" } };

  const email = await resolverEmail(identificador);
  if (email) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
    const supabase = await createClient();
    // El resultado se ignora a propósito: la respuesta es siempre la misma.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${proto}://${host}/auth/callback?next=/nueva-contrasena`,
    });
  }

  return { ok: RESPUESTA, valores: { identificador } };
}
