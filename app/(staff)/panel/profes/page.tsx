import Link from "next/link";
import { redirect } from "next/navigation";
import { BotonAccion } from "@/components/staff/BotonAccion";
import { Cabecera, Insignia } from "@/components/staff/Cabecera";
import e from "@/components/staff/estilos.module.css";
import { getUsuario } from "@/lib/auth/usuario";
import { createClient } from "@/lib/supabase/server";
import { cambiarEstadoProfe } from "./actions";

export const metadata = { title: "Profes · Unbex Rutinas" };

export default async function ProfesPage() {
  const usuario = await getUsuario();
  if (usuario?.profile.rol !== "admin") redirect("/panel");

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, dni, email, rol, estado")
    .in("rol", ["profe", "admin"])
    .order("apellido");

  return (
    <>
      <Cabecera titulo="Profes">
        <Link href="/panel/profes/nuevo" className={e.btn}>
          Nuevo profe
        </Link>
      </Cabecera>
      <div className={e.tablaWrap}>
        <table className={e.tabla}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((p) => (
              <tr key={p.id}>
                <td>
                  {p.apellido}, {p.nombre}
                </td>
                <td>{p.dni}</td>
                <td>{p.email}</td>
                <td>{p.rol === "admin" ? "Admin" : "Profe"}</td>
                <td>
                  <Insignia estado={p.estado} />
                </td>
                <td>
                  {p.rol === "profe" &&
                    (p.estado === "activo" ? (
                      <BotonAccion
                        texto="Desactivar"
                        variante="peligro"
                        confirmar={`¿Desactivar a ${p.nombre}? Pierde el acceso al panel.`}
                        accion={cambiarEstadoProfe.bind(null, p.id, "inactivo")}
                      />
                    ) : (
                      <BotonAccion texto="Activar" accion={cambiarEstadoProfe.bind(null, p.id, "activo")} />
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
