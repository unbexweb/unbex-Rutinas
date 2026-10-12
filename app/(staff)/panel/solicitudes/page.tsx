import Link from "next/link";
import { Cabecera } from "@/components/staff/Cabecera";
import { SelectorAccion } from "@/components/staff/SelectorAccion";
import e from "@/components/staff/estilos.module.css";
import { createClient } from "@/lib/supabase/server";
import { atenderSolicitud } from "./actions";

export const metadata = { title: "Solicitudes · Unbex Rutinas" };

export default async function SolicitudesPage() {
  const supabase = await createClient();

  const [{ data: solicitudes }, { data: planes }] = await Promise.all([
    supabase
      .from("solicitudes_ciclo")
      .select("id, tipo_solicitado, nota, created_at, alumno:profiles!solicitudes_ciclo_alumno_id_fkey (id, nombre, apellido)")
      .eq("estado", "pendiente")
      .order("created_at"),
    supabase.from("planes").select("id, nombre, tipo").is("alumno_id", null).order("nombre"),
  ]);

  const opciones = (planes ?? []).map((p) => ({ value: p.id, label: p.nombre }));

  return (
    <>
      <Cabecera titulo="Solicitudes de ciclo" />
      {!solicitudes?.length ? (
        <p className={e.ayuda}>No hay solicitudes pendientes.</p>
      ) : (
        <div className={e.stack}>
          {solicitudes.map((s) => {
            // Si el plan se llama como lo que pidió el alumno, ya queda elegido.
            const sugerido = (planes ?? []).find(
              (p) => p.nombre.toLowerCase() === s.tipo_solicitado.toLowerCase() || p.tipo.toLowerCase() === s.tipo_solicitado.toLowerCase(),
            );
            return (
              <article key={s.id} className={`${e.panel} ${e.stack}`}>
                <div>
                  <h2>
                    {s.alumno ? (
                      <Link href={`/panel/alumnos/${s.alumno.id}`}>
                        {s.alumno.nombre} {s.alumno.apellido}
                      </Link>
                    ) : (
                      "Alumno"
                    )}
                  </h2>
                  <p>
                    Pidió: <strong>{s.tipo_solicitado}</strong> ·{" "}
                    {new Date(s.created_at).toLocaleDateString("es-AR")}
                  </p>
                  {s.nota && <p>“{s.nota}”</p>}
                </div>
                <SelectorAccion
                  etiqueta="Plan a asignar"
                  texto="Atender"
                  opciones={opciones}
                  valorInicial={sugerido?.id}
                  accion={atenderSolicitud.bind(null, s.id)}
                  confirmar="Se asigna el plan elegido desde la Semana 1 · Estímulo 1 y la solicitud queda atendida. ¿Confirmás?"
                />
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
