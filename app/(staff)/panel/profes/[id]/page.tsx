import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BotonAccion } from "@/components/staff/BotonAccion";
import { BotonRestablecer } from "@/components/staff/BotonRestablecer";
import { Cabecera, Insignia } from "@/components/staff/Cabecera";
import e from "@/components/staff/estilos.module.css";
import { getUsuario } from "@/lib/auth/usuario";
import { createClient } from "@/lib/supabase/server";
import { cambiarEstadoProfe, restablecerPasswordProfe } from "../actions";

export const metadata = { title: "Profe · Unbex Rutinas" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProfeDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuario();
  if (usuario?.profile.rol !== "admin") redirect("/panel");

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: profe } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, dni, email, estado")
    .eq("id", id)
    .eq("rol", "profe")
    .maybeSingle();
  if (!profe) notFound();

  return (
    <>
      <Cabecera titulo={`${profe.nombre} ${profe.apellido}`}>
        <Link href="/panel/profes" className={`${e.btn} ${e.btnSec}`}>
          Volver a profes
        </Link>
      </Cabecera>
      <section className={`${e.panel} ${e.stack}`} style={{ maxWidth: "36rem" }} aria-labelledby="datos">
        <h2 id="datos">Datos</h2>
        <dl className={e.datos}>
          <dt>DNI</dt>
          <dd>{profe.dni}</dd>
          <dt>Email</dt>
          <dd>{profe.email}</dd>
          <dt>Estado</dt>
          <dd>
            <Insignia estado={profe.estado} />
          </dd>
        </dl>
        <div className={e.fila}>
          {profe.estado === "activo" ? (
            <BotonAccion
              texto="Desactivar"
              variante="peligro"
              confirmar={`¿Desactivar a ${profe.nombre}? Pierde el acceso al panel.`}
              accion={cambiarEstadoProfe.bind(null, id, "inactivo")}
            />
          ) : (
            <BotonAccion texto="Activar" accion={cambiarEstadoProfe.bind(null, id, "activo")} />
          )}
        </div>
        <BotonRestablecer nombre={profe.nombre} accion={restablecerPasswordProfe.bind(null, id)} />
      </section>
    </>
  );
}
