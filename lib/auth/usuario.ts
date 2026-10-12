import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Profile = Pick<Tables<"profiles">, "id" | "rol" | "estado" | "gym_id" | "nombre" | "apellido">;

// Una consulta por request, aunque la llamen el layout y la página.
export const getUsuario = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, rol, estado, gym_id, nombre, apellido")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return { user, profile: profile as Profile };
});

export type Usuario = NonNullable<Awaited<ReturnType<typeof getUsuario>>>;

// A dónde corresponde que vaya cada usuario. La seguridad real la da RLS: esto es navegación.
export function destinoPara({ profile }: Usuario): string {
  if (profile.estado === "pendiente") return "/pendiente";
  if (profile.estado === "inactivo") return "/inactivo";
  return profile.rol === "alumno" ? "/inicio" : "/panel";
}

export async function requerirUsuario(ambito: "alumno" | "staff"): Promise<Usuario> {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");
  const destino = destinoPara(usuario);
  const ok = ambito === "alumno" ? destino === "/inicio" : destino === "/panel";
  if (!ok) redirect(destino);
  return usuario;
}

// /pendiente e /inactivo: solo para quien tiene ese estado.
export async function requerirEstado(estado: "pendiente" | "inactivo"): Promise<Usuario> {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");
  const destino = destinoPara(usuario);
  if (destino !== `/${estado}`) redirect(destino);
  return usuario;
}

// Páginas de auth (login, registro, recuperar): si ya hay sesión, a donde corresponda.
export async function redirigirSiHaySesion() {
  const usuario = await getUsuario();
  if (usuario) redirect(destinoPara(usuario));
}
