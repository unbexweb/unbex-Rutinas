import Link from "next/link";
import { BotonAccion } from "@/components/staff/BotonAccion";
import { BotonEliminarEjercicio } from "@/components/staff/BotonEliminarEjercicio";
import { Cabecera } from "@/components/staff/Cabecera";
import { FormEjercicio } from "@/components/staff/FormEjercicio";
import e from "@/components/staff/estilos.module.css";
import { createClient } from "@/lib/supabase/server";
import { cambiarActivo, eliminarEjercicio, guardarEjercicio } from "./actions";

export const metadata = { title: "Ejercicios · Unbex Rutinas" };

export default async function EjerciciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ver?: string; editar?: string; nuevo?: string }>;
}) {
  const { q = "", ver = "", editar, nuevo } = await searchParams;
  const supabase = await createClient();

  let consulta = supabase
    .from("ejercicios")
    .select("id, nombre, video_url, youtube_id, descripcion, activo")
    .order("nombre");
  if (ver === "inactivos") consulta = consulta.eq("activo", false);
  else if (ver !== "todos") consulta = consulta.eq("activo", true);

  const busqueda = q.replace(/[%_\\]/g, " ").trim();
  if (busqueda) consulta = consulta.ilike("nombre", `%${busqueda}%`);

  const { data } = await consulta;
  const ejercicios = data ?? [];

  const enEdicion = editar ? ejercicios.find((x) => x.id === editar) ?? (await cargar(editar)) : null;

  async function cargar(id: string) {
    const { data: uno } = await supabase
      .from("ejercicios")
      .select("id, nombre, video_url, youtube_id, descripcion, activo")
      .eq("id", id)
      .maybeSingle();
    return uno;
  }

  return (
    <>
      <Cabecera titulo="Biblioteca de ejercicios">
        <Link href="/panel/ejercicios?nuevo=1" className={e.btn}>
          Nuevo ejercicio
        </Link>
      </Cabecera>

      {nuevo && <FormEjercicio accion={guardarEjercicio} />}
      {enEdicion && (
        <FormEjercicio
          key={enEdicion.id}
          accion={guardarEjercicio}
          inicial={{
            id: enEdicion.id,
            nombre: enEdicion.nombre,
            video_url: enEdicion.video_url ?? "",
            descripcion: enEdicion.descripcion ?? "",
          }}
        />
      )}

      <form className={e.busqueda} role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" />
        <select name="ver" defaultValue={ver} aria-label="Cuáles mostrar">
          <option value="">Activos</option>
          <option value="inactivos">Desactivados</option>
          <option value="todos">Todos</option>
        </select>
        <button type="submit" className={e.btn}>
          Buscar
        </button>
      </form>

      <div className={e.tablaWrap}>
        {ejercicios.length === 0 ? (
          <p className={e.vacio}>No hay ejercicios con esos filtros.</p>
        ) : (
          <table className={e.tabla}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Video</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ejercicios.map((x) => (
                <tr key={x.id}>
                  <td>{x.nombre}</td>
                  <td>{x.youtube_id ? "YouTube" : x.video_url ? "Otro link" : "—"}</td>
                  <td>
                    <span className={`${e.insignia} ${x.activo ? e.insigniaActivo : e.insigniaInactivo}`}>
                      {x.activo ? "Activo" : "Desactivado"}
                    </span>
                  </td>
                  <td>
                    <div className={e.fila}>
                      <Link href={`/panel/ejercicios?editar=${x.id}`} className={`${e.btn} ${e.btnSec}`}>
                        Editar
                      </Link>
                      <BotonAccion
                        texto={x.activo ? "Desactivar" : "Reactivar"}
                        variante="secundario"
                        accion={cambiarActivo.bind(null, x.id, !x.activo)}
                      />
                      <BotonEliminarEjercicio
                        nombre={x.nombre}
                        eliminar={eliminarEjercicio.bind(null, x.id)}
                        desactivar={cambiarActivo.bind(null, x.id, false)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
