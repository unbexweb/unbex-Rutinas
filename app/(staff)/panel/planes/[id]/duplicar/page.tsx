import { notFound } from "next/navigation";
import { Cabecera } from "@/components/staff/Cabecera";
import { FormPlan } from "@/components/staff/FormPlan";
import { createClient } from "@/lib/supabase/server";
import { duplicarPlan } from "../../actions";

export const metadata = { title: "Duplicar plan · Unbex Rutinas" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DuplicarPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: plan } = await supabase.from("planes").select("id, nombre, tipo, nivel").eq("id", id).maybeSingle();
  if (!plan) notFound();

  return (
    <>
      <Cabecera titulo={`Duplicar “${plan.nombre}”`} />
      <p>Se crea una plantilla nueva e independiente, con una copia de todos los bloques y ejercicios.</p>
      <FormPlan
        accion={duplicarPlan.bind(null, id)}
        textoBoton="Duplicar plan"
        idPrefijo="dup"
        inicial={{ nombre: `${plan.nombre} (copia)`, tipo: plan.tipo, nivel: plan.nivel ?? "" }}
      />
    </>
  );
}
