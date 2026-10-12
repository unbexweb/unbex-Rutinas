import { BotonCerrarSesion } from "@/components/ui/BotonCerrarSesion";
import { Mensaje } from "@/components/ui/Mensaje";
import { Pantalla } from "@/components/ui/Pantalla";
import { requerirEstado } from "@/lib/auth/usuario";

export const metadata = { title: "Cuenta inactiva · Unbex Rutinas" };

export default async function InactivoPage() {
  await requerirEstado("inactivo");

  return (
    <Pantalla titulo="Cuenta inactiva">
      <Mensaje>Tu cuenta está inactiva. Consultá en recepción.</Mensaje>
      <BotonCerrarSesion />
    </Pantalla>
  );
}
