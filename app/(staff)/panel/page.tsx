import Link from "next/link";
import { Cabecera } from "@/components/staff/Cabecera";
import e from "@/components/staff/estilos.module.css";
import { getUsuario } from "@/lib/auth/usuario";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Panel · Unbex Rutinas" };

export default async function PanelStaffPage() {
  const usuario = await getUsuario();
  const supabase = await createClient();

  const [pendientes, solicitudes, activos, conPlan] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("rol", "alumno").eq("estado", "pendiente"),
    supabase.from("solicitudes_ciclo").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("profiles").select("id").eq("rol", "alumno").eq("estado", "activo"),
    supabase.from("asignaciones").select("alumno_id").eq("estado", "activa"),
  ]);

  const conPlanIds = new Set((conPlan.data ?? []).map((a) => a.alumno_id));
  const sinPlan = (activos.data ?? []).filter((a) => !conPlanIds.has(a.id)).length;

  const tarjetas = [
    { href: "/panel/alumnos?estado=pendiente", numero: pendientes.count ?? 0, texto: "Alumnos pendientes de aprobación" },
    { href: "/panel/solicitudes", numero: solicitudes.count ?? 0, texto: "Solicitudes de ciclo pendientes" },
    { href: "/panel/alumnos?sinplan=1", numero: sinPlan, texto: "Alumnos activos sin plan" },
  ];

  return (
    <>
      <Cabecera titulo={`¡Hola, ${usuario?.profile.nombre}!`} />
      <div className={e.tarjetas}>
        {tarjetas.map((t) => (
          <Link key={t.href} href={t.href} className={e.tarjeta}>
            <span className={e.numero}>{t.numero}</span>
            <span>{t.texto}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
