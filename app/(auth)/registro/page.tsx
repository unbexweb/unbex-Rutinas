import { Pantalla } from "@/components/ui/Pantalla";
import { FormRegistro } from "./form";

export const metadata = { title: "Crear cuenta · Unbex Rutinas" };

export default function RegistroPage() {
  return (
    <Pantalla titulo="Creá tu cuenta">
      <FormRegistro />
    </Pantalla>
  );
}
