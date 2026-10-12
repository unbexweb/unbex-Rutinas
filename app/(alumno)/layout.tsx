import { requerirUsuario } from "@/lib/auth/usuario";

export default async function AlumnoLayout({ children }: { children: React.ReactNode }) {
  await requerirUsuario("alumno");
  return children;
}
