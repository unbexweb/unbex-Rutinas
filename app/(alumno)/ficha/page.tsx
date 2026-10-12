import { Pantalla } from "@/components/ui/Pantalla";
import { getUsuario } from "@/lib/auth/usuario";
import { createClient } from "@/lib/supabase/server";
import { FormFicha } from "./form";

export const metadata = { title: "Mi ficha · Unbex Rutinas" };

export default async function FichaPage() {
  const usuario = await getUsuario();
  const supabase = await createClient();
  const { data } = await supabase
    .from("fichas_salud")
    .select("*")
    .eq("alumno_id", usuario!.user.id)
    .maybeSingle();

  return (
    <Pantalla titulo="Mi ficha de salud">
      <p>Es opcional. Si querés, contale a tu profe lo que te parezca importante.</p>
      <FormFicha ficha={data} />
    </Pantalla>
  );
}
