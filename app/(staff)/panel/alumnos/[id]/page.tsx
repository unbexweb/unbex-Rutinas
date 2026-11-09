import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonAccion } from "@/components/staff/BotonAccion";
import { BotonRestablecer } from "@/components/staff/BotonRestablecer";
import { Cabecera, Insignia } from "@/components/staff/Cabecera";
import { SelectorAccion } from "@/components/staff/SelectorAccion";
import e from "@/components/staff/estilos.module.css";
import { SESIONES_POR_PLAN } from "@/lib/alumno/datos";
import { createClient } from "@/lib/supabase/server";
import { CAMPOS_FICHA } from "@/app/(alumno)/ficha/campos";
import { asignarPlan, cambiarEstadoAlumno, personalizarPlan, restablecerPasswordAlumno } from "../actions";

export const metadata = { title: "Alumno · Unbex Rutinas" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fmt = (n: number | string) => String(n).replace(".", ",");

export default async function AlumnoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();

  const { data: alumno } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, dni, email, estado, created_at")
    .eq("id", id)
    .eq("rol", "alumno")
    .maybeSingle();
  if (!alumno) notFound();

  const [{ data: asignaciones }, { data: planes }, { data: ficha }] = await Promise.all([
    supabase.from("asignaciones").select("*").eq("alumno_id", id).order("created_at", { ascending: false }),
    supabase.from("planes").select("id, nombre, tipo, alumno_id").order("nombre"),
    supabase.from("fichas_salud").select("*").eq("alumno_id", id).maybeSingle(),
  ]);

  const actual = asignaciones?.find((a) => a.estado === "activa") ?? asignaciones?.[0] ?? null;
  const planActual = planes?.find((p) => p.id === actual?.plan_id) ?? null;
  const opcionesPlan = (planes ?? [])
    .filter((p) => p.alumno_id === null || p.alumno_id === id)
    .map((p) => ({ value: p.id, label: p.alumno_id ? `${p.nombre} (personalizado)` : p.nombre }));

  const { data: registros } = asignaciones?.length
    ? await supabase
        .from("registros_sesion")
        .select(
          `id, fecha, asignacion_id,
           sesion:sesiones (semana, estimulo),
           series:registros_series (
             n_serie, peso, reps,
             ejercicio:ejercicios!registros_series_ejercicio_usado_id_fkey (nombre)
           )`,
        )
        .in("asignacion_id", asignaciones.map((a) => a.id))
        .eq("completada", true)
        .order("fecha", { ascending: false })
    : { data: [] };

  const historial = (registros ?? [])
    .filter((r) => r.sesion)
    .sort(
      (a, b) =>
        b.fecha.localeCompare(a.fecha) ||
        (b.sesion!.semana - a.sesion!.semana) ||
        (b.sesion!.estimulo - a.sesion!.estimulo),
    );

  // Entrenamientos completos de la asignación vigente (el plan es libre: no depende de por dónde va)
  const hechosActual = actual ? (registros ?? []).filter((r) => r.asignacion_id === actual.id).length : 0;

  const fichaCargada = ficha && CAMPOS_FICHA.some((c) => ficha[c.name]);

  return (
    <>
      <Cabecera titulo={`${alumno.nombre} ${alumno.apellido}`}>
        <Link href="/panel/alumnos" className={`${e.btn} ${e.btnSec}`}>
          Volver a alumnos
        </Link>
      </Cabecera>

      <div className={e.grilla2}>
        <section className={`${e.panel} ${e.stack}`} aria-labelledby="datos">
          <h2 id="datos">Datos</h2>
          <dl className={e.datos}>
            <dt>DNI</dt>
            <dd>{alumno.dni}</dd>
            <dt>Email</dt>
            <dd>{alumno.email}</dd>
            <dt>Estado</dt>
            <dd>
              <Insignia estado={alumno.estado} />
            </dd>
          </dl>
          <div className={e.fila}>
            {alumno.estado === "pendiente" && (
              <BotonAccion texto="Aprobar" accion={cambiarEstadoAlumno.bind(null, id, "activo")} />
            )}
            {alumno.estado === "inactivo" && (
              <BotonAccion texto="Activar" accion={cambiarEstadoAlumno.bind(null, id, "activo")} />
            )}
            {alumno.estado !== "inactivo" && (
              <BotonAccion
                texto="Desactivar"
                variante="peligro"
                confirmar={`¿Desactivar a ${alumno.nombre}? Deja de ver sus planes y de poder entrenar.`}
                accion={cambiarEstadoAlumno.bind(null, id, "inactivo")}
              />
            )}
          </div>
          <BotonRestablecer
            nombre={alumno.nombre}
            accion={restablecerPasswordAlumno.bind(null, id)}
          />
        </section>

        <section className={`${e.panel} ${e.stack}`} aria-labelledby="plan">
          <h2 id="plan">Plan</h2>
          {actual && planActual ? (
            <>
              <p>
                <strong>{planActual.nombre}</strong>
                {planActual.alumno_id ? " (personalizado)" : ""}
                {actual.estado === "finalizada" ? " · finalizado" : ""}
              </p>
              <p>
                {hechosActual} de {SESIONES_POR_PLAN} entrenamientos
                {actual.estado === "activa" &&
                  ` · sugerido: Semana ${actual.semana_actual} · Estímulo ${actual.estimulo_actual}`}
              </p>
              <progress className={e.barra} value={hechosActual} max={SESIONES_POR_PLAN} aria-label="Progreso" />
              <div className={e.fila}>
                {planActual.alumno_id ? (
                  <Link href={`/panel/planes/${planActual.id}`} className={`${e.btn} ${e.btnSec}`}>
                    Editar plan personalizado
                  </Link>
                ) : (
                  <BotonAccion
                    texto="Personalizar plan"
                    variante="secundario"
                    confirmar={`Se crea una copia de “${planActual.nombre}” solo para ${alumno.nombre}, con su progreso. ¿Seguimos?`}
                    accion={personalizarPlan.bind(null, id, planActual.id)}
                    deshabilitado={actual.estado !== "activa"}
                  />
                )}
              </div>
            </>
          ) : (
            <p>Todavía no tiene un plan asignado.</p>
          )}
          <SelectorAccion
            etiqueta={actual ? "Cambiar plan" : "Asignar plan"}
            texto={actual ? "Cambiar" : "Asignar"}
            opciones={opcionesPlan}
            accion={asignarPlan.bind(null, id)}
            confirmar={
              actual?.estado === "activa"
                ? "Se finaliza el plan actual y empieza el nuevo desde la Semana 1 · Estímulo 1. El historial se conserva. ¿Seguimos?"
                : undefined
            }
          />
        </section>
      </div>

      <h2 className={e.subtitulo}>Historial de entrenamientos</h2>
      {historial.length === 0 ? (
        <p className={e.ayuda}>Todavía no completó ningún entrenamiento.</p>
      ) : (
        <div className={e.stack}>
          {historial.map((r) => (
            <details key={r.id} className={`${e.panel} ${e.detalle}`}>
              <summary>
                Semana {r.sesion!.semana} · Estímulo {r.sesion!.estimulo} — {r.fecha.split("-").reverse().join("/")}
              </summary>
              <SeriesPorEjercicio series={r.series} />
            </details>
          ))}
        </div>
      )}

      <h2 className={e.subtitulo}>Ficha de salud</h2>
      {fichaCargada ? (
        <dl className={`${e.panel} ${e.datos}`}>
          {CAMPOS_FICHA.map((c) => (
            <Fila key={c.name} etiqueta={c.label} valor={ficha[c.name]} />
          ))}
        </dl>
      ) : (
        <p className={e.ayuda}>El alumno no completó su ficha.</p>
      )}
    </>
  );

  function Fila({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
    return (
      <>
        <dt>{etiqueta}</dt>
        <dd>{valor || "—"}</dd>
      </>
    );
  }
}

function SeriesPorEjercicio({
  series,
}: {
  series: { n_serie: number; peso: number | null; reps: number | null; ejercicio: { nombre: string } | null }[];
}) {
  const grupos = new Map<string, typeof series>();
  for (const s of [...series].sort((a, b) => a.n_serie - b.n_serie)) {
    const nombre = s.ejercicio?.nombre ?? "Ejercicio";
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), s]);
  }
  if (!grupos.size) return <p className={e.ayuda}>No registró pesos en este entrenamiento.</p>;
  return (
    <ul>
      {[...grupos].map(([nombre, lista]) => (
        <li key={nombre}>
          <strong>{nombre}:</strong>{" "}
          {lista
            .map((s) => `${s.peso != null ? `${fmt(s.peso)} kg` : "—"} × ${s.reps ?? "—"}`)
            .join(" · ")}
        </li>
      ))}
    </ul>
  );
}
