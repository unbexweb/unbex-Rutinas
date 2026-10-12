import { cerrarSesion } from "@/lib/auth/acciones";
import { Boton } from "./Boton";

export function BotonCerrarSesion() {
  return (
    <form action={cerrarSesion}>
      <Boton variante="secundario">Cerrar sesión</Boton>
    </form>
  );
}
