import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { soloDigitos } from "./validar";

// "Email o DNI" → email. Si es DNI, lo busca con la función server-side (service role).
// Devuelve null si no se puede resolver; quien llama decide qué mostrar.
export async function resolverEmail(identificador: string): Promise<string | null> {
  const valor = identificador.trim();
  if (valor.includes("@")) return valor.toLowerCase();

  const dni = soloDigitos(valor);
  if (!dni) return null;
  const { data } = await createAdminClient().rpc("email_por_dni", { p_dni: dni });
  return data ?? null;
}
