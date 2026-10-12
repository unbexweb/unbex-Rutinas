import Link from "next/link";
import { BotonAccion } from "@/components/staff/BotonAccion";
import { Cabecera } from "@/components/staff/Cabecera";
import e from "@/components/staff/estilos.module.css";
import { createClient } from "@/lib/supabase/server";
import { eliminarPlan } from "./actions";

export const metadata = { title: "Planes · Unbex Rutinas" };

export default async function PlanesPage() {
  const supabase = await createClient();
  const [{ data: planes }, { data: asignaciones }] = await Promise.all([
    supabase
      .from("planes")
      .select("id, nombre, tipo, nivel, alumno_id, alumno:profiles!planes_alumno_id_fkey (nombre, apellido)")
      .order("nombre"),
    supabase.from("asignaciones").select("plan_id, alumno_id, estado"),
  ]);

  const activosPorPlan = new Map<string, number>();
  for (const a of asignaciones ?? []) {
    if (a.estado === "activa") activosPorPlan.set(a.plan_id, (activosPorPlan.get(a.plan_id) ?? 0) + 1);
  }

  const plantillas = (planes ?? []).filter((p) => !p.alumno_id);
  const personalizados = (planes ?? []).filter((p) => p.alumno_id);

  function Tabla({ lista, personalizado }: { lista: typeof plantillas; personalizado?: boolean }) {
    if (!lista.length) return <p className={e.ayuda}>No hay planes acá todavía.</p>;
    return (
      <div className={e.tablaWrap}>
        <table className={e.tabla}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>{personalizado ? "Alumno" : "Alumnos activos"}</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/panel/planes/${p.id}`}>{p.nombre}</Link>
                  {p.nivel && <span className={e.ayuda}> · {p.nivel}</span>}
                </td>
                <td>{p.tipo}</td>
                <td>
                  {personalizado
                    ? p.alumno
                      ? `${p.alumno.nombre} ${p.alumno.apellido}`
                      : "—"
                    : (activosPorPlan.get(p.id) ?? 0)}
                </td>
                <td>
                  <div className={e.fila}>
                    <Link href={`/panel/planes/${p.id}`} className={`${e.btn} ${e.btnSec}`}>
                      Editar
                    </Link>
                    <Link href={`/panel/planes/${p.id}/duplicar`} className={`${e.btn} ${e.btnSec}`}>
                      Duplicar
                    </Link>
                    <BotonAccion
                      texto="Eliminar"
                      variante="peligro"
                      confirmar={`¿Eliminar “${p.nombre}”? Se borran sus 24 entrenamientos. No se puede deshacer.`}
                      accion={eliminarPlan.bind(null, p.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <Cabecera titulo="Planes">
        <Link href="/panel/planes/nuevo" className={e.btn}>
          Nuevo plan
        </Link>
      </Cabecera>
      <h2 className={e.subtitulo} style={{ marginTop: 0 }}>
        Plantillas
      </h2>
      <Tabla lista={plantillas} />
      <h2 className={e.subtitulo}>Personalizados</h2>
      <Tabla lista={personalizados} personalizado />
    </>
  );
}
