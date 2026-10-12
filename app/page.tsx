import { redirect } from "next/navigation";
import { destinoPara, getUsuario } from "@/lib/auth/usuario";

// Ruteo por rol: sin sesión → /login; si no, a donde corresponde.
export default async function Home() {
  const usuario = await getUsuario();
  redirect(usuario ? destinoPara(usuario) : "/login");
}
