import Link from "next/link";
import { Cabecera, Insignia } from "@/components/staff/Cabecera";
import e from "@/components/staff/estilos.module.css";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Alumnos · Unbex Rutinas" };

const ESTADOS = ["pendiente", "activo", "inactivo"] as const;

export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; sinplan?: string }>;
}) {
  const { q = "", estado = "", sinplan } = await searchParams;
  const supabase = await createClient();

  let consulta = supabase
    .from("profiles")
    .select("id, nombre, apellido, dni, email, estado")
    .eq("rol", "alumno")
    .order("apellido")
    .order("nombre");

  const filtroEstado = ESTADOS.find((s) => s === estado);
  if (filtroEstado) consulta = consulta.eq("estado", filtroEstado);
  else if (sinplan) consulta = consulta.eq("estado", "activo");

  // Se quitan los caracteres que tienen significado en el filtro de PostgREST.
  const busqueda = q.replace(/[,()%*\\_]/g, " ").trim();
  if (busqueda) {
    consulta = consulta.or(
      `nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,dni.ilike.%${busqueda}%`,
    );
  }

  const { data } = await consulta;
  let alumnos = data ?? [];

  if (sinplan) {
    const { data: activas } = await supabase.from("asignaciones").select("alumno_id").eq("estado", "activa");
    const conPlan = new Set((activas ?? []).map((a) => a.alumno_id));
    alumnos = alumnos.filter((a) => !conPlan.has(a.id));
  }

  return (
    <>
      <Cabecera titulo="Alumnos">
        <Link href="/panel/alumnos/nuevo" className={e.btn}>
          Nuevo alumno
        </Link>
      </Cabecera>

      <form className={e.busqueda} role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o DNI"
          aria-label="Buscar por nombre o DNI"
        />
        <select name="estado" defaultValue={filtroEstado ?? ""} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        {sinplan && <input type="hidden" name="sinplan" value="1" />}
        <button type="submit" className={e.btn}>
          Buscar
        </button>
      </form>
      {sinplan && <p className={e.ayuda}>Mostrando solo alumnos activos sin plan asignado.</p>}

      <div className={e.tablaWrap}>
        {alumnos.length === 0 ? (
          <p className={e.vacio}>No hay alumnos con esos filtros.</p>
        ) : (
          <table className={e.tabla}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Email</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/panel/alumnos/${a.id}`}>
                      {a.apellido}, {a.nombre}
                    </Link>
                  </td>
                  <td>{a.dni}</td>
                  <td>{a.email}</td>
                  <td>
                    <Insignia estado={a.estado} />
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
