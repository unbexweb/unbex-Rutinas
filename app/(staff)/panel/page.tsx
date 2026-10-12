import { BotonCerrarSesion } from "@/components/ui/BotonCerrarSesion";
import { Pantalla } from "@/components/ui/Pantalla";
import { getUsuario } from "@/lib/auth/usuario";

export default async function PanelStaffPage() {
  const usuario = await getUsuario();

  return (
    <Pantalla titulo={`¡Hola, ${usuario?.profile.nombre}!`}>
      <p>Pronto vas a ver acá el panel del gimnasio.</p>
      <BotonCerrarSesion />
    </Pantalla>
  );
}
