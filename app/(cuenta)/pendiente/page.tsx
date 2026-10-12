import { BotonCerrarSesion } from "@/components/ui/BotonCerrarSesion";
import { Mensaje } from "@/components/ui/Mensaje";
import { Pantalla } from "@/components/ui/Pantalla";
import { requerirEstado } from "@/lib/auth/usuario";

export const metadata = { title: "Cuenta pendiente · Unbex Rutinas" };

export default async function PendientePage() {
  await requerirEstado("pendiente");

  return (
    <Pantalla titulo="¡Ya casi!">
      <Mensaje>Tu cuenta está pendiente de aprobación. Avisale a tu profe.</Mensaje>
      <BotonCerrarSesion />
    </Pantalla>
  );
}
