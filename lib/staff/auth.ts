import "server-only";
import { destinoPara, getUsuario, type Usuario } from "@/lib/auth/usuario";

// Para Server Actions: devuelve el usuario solo si es profe o admin ACTIVO.
// Toda acción que use el cliente admin (service role) debe empezar por acá.
export async function verificarStaff(): Promise<Usuario | null> {
  const usuario = await getUsuario();
  if (!usuario || destinoPara(usuario) !== "/panel") return null;
  return usuario;
}

export async function verificarAdmin(): Promise<Usuario | null> {
  const usuario = await verificarStaff();
  return usuario?.profile.rol === "admin" ? usuario : null;
}

export const SIN_PERMISO = "No tenés permiso para hacer esto.";
