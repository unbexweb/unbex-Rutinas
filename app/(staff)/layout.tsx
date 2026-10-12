import { Shell } from "@/components/staff/Shell";
import { requerirUsuario } from "@/lib/auth/usuario";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requerirUsuario("staff");
  return (
    <Shell nombre={`${profile.nombre} ${profile.apellido}`} esAdmin={profile.rol === "admin"}>
      {children}
    </Shell>
  );
}
