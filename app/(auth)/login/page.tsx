import { Pantalla } from "@/components/ui/Pantalla";
import { FormLogin } from "./form";

export const metadata = { title: "Entrar · Unbex Rutinas" };

export default function LoginPage() {
  return (
    <Pantalla titulo="Entrá a tu cuenta">
      <FormLogin />
    </Pantalla>
  );
}
