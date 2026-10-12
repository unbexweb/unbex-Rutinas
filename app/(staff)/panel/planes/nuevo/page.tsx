import { Cabecera } from "@/components/staff/Cabecera";
import { FormPlan } from "@/components/staff/FormPlan";
import { crearPlan } from "../actions";

export const metadata = { title: "Nuevo plan · Unbex Rutinas" };

export default function NuevoPlanPage() {
  return (
    <>
      <Cabecera titulo="Nuevo plan" />
      <p>Se crea con los 24 entrenamientos vacíos (4 semanas × 6 estímulos). Después los armás en el editor.</p>
      <FormPlan accion={crearPlan} textoBoton="Crear plan" idPrefijo="nuevo" />
    </>
  );
}
