import { redirect } from "next/navigation";
import { Pantalla } from "@/components/ui/Pantalla";
import { getUsuario } from "@/lib/auth/usuario";
import { FormNuevaContrasena } from "./form";

export const metadata = { title: "Nueva contraseña · Unbex Rutinas" };

export default async function NuevaContrasenaPage() {
  // Se llega con la sesión que abrió el link del mail; sin sesión no hay nada que cambiar.
  if (!(await getUsuario())) redirect("/login");

  return (
    <Pantalla titulo="Elegí una contraseña nueva">
      <FormNuevaContrasena />
    </Pantalla>
  );
}
