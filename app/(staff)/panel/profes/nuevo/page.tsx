import { redirect } from "next/navigation";
import { Cabecera } from "@/components/staff/Cabecera";
import { FormAlta } from "@/components/staff/FormAlta";
import { getUsuario } from "@/lib/auth/usuario";
import { altaProfe } from "../actions";

export const metadata = { title: "Nuevo profe · Unbex Rutinas" };

export default async function NuevoProfePage() {
  const usuario = await getUsuario();
  if (usuario?.profile.rol !== "admin") redirect("/panel");

  return (
    <>
      <Cabecera titulo="Nuevo profe" />
      <FormAlta accion={altaProfe} textoBoton="Crear profe" volverHref="/panel/profes" volverTexto="Volver a profes" />
    </>
  );
}
