import { redirigirSiHaySesion } from "@/lib/auth/usuario";

// Login, registro y recuperar: si ya hay sesión, no tiene sentido mostrarlos.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  await redirigirSiHaySesion();
  return children;
}
