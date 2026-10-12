import { Pantalla } from "@/components/ui/Pantalla";
import { FormRecuperar } from "./form";

export const metadata = { title: "Recuperar contraseña · Unbex Rutinas" };

export default function RecuperarPage() {
  return (
    <Pantalla titulo="Recuperá tu contraseña">
      <FormRecuperar />
    </Pantalla>
  );
}
