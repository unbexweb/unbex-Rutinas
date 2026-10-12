import { requerirUsuario } from "@/lib/auth/usuario";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requerirUsuario("staff");
  return children;
}
