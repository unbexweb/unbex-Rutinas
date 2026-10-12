import { Cabecera } from "@/components/staff/Cabecera";
import { FormAlta } from "@/components/staff/FormAlta";
import { altaAlumno } from "../actions";

export const metadata = { title: "Nuevo alumno · Unbex Rutinas" };

export default function NuevoAlumnoPage() {
  return (
    <>
      <Cabecera titulo="Nuevo alumno" />
      <FormAlta
        accion={altaAlumno}
        textoBoton="Crear alumno"
        volverHref="/panel/alumnos"
        volverTexto="Volver a alumnos"
      />
    </>
  );
}
