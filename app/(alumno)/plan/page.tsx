import Link from "next/link";
import { FormSolicitud } from "@/components/alumno/FormSolicitud";
import { Mensaje } from "@/components/ui/Mensaje";
import { Pantalla } from "@/components/ui/Pantalla";
import { getAsignacion, getProgreso, SESIONES_POR_PLAN } from "@/lib/alumno/datos";
import { createClient } from "@/lib/supabase/server";
import { PedirCiclo } from "./pedir-ciclo";
import styles from "./plan.module.css";

export const metadata = { title: "Mi plan · Unbex Rutinas" };

const ESTADOS = {
  hecho: { icono: "✓", texto: "Hecho" },
  sugerido: { icono: "▶", texto: "Sugerido" },
  pendiente: { icono: "○", texto: "Pendiente" },
} as const;

export default async function PlanPage() {
  const asignacion = await getAsignacion();
  if (!asignacion) {
    return (
      <Pantalla titulo="Mi plan">
        <Mensaje>Todavía no tenés un plan asignado. Hablá con tu profe.</Mensaje>
      </Pantalla>
    );
  }

  const supabase = await createClient();
  const [{ data: sesiones }, { hechos, completadas }, { data: solicitud }] = await Promise.all([
    supabase
      .from("sesiones")
      .select("id, semana, estimulo")
      .eq("plan_id", asignacion.plan_id)
      .order("semana")
      .order("estimulo"),
    getProgreso(asignacion.id),
    supabase
      .from("solicitudes_ciclo")
      .select("id")
      .eq("asignacion_id", asignacion.id)
      .eq("estado", "pendiente")
      .limit(1),
  ]);

  const activa = asignacion.estado === "activa";
  const pendientes = SESIONES_POR_PLAN - hechos;

  return (
    <Pantalla titulo="Mi plan">
      <p className={styles.resumen}>
        {hechos} de {SESIONES_POR_PLAN} entrenamientos hechos
      </p>
      <p className={styles.ayuda}>Podés hacer los entrenamientos en el orden que quieras. Tocá el que prefieras.</p>

      {[1, 2, 3, 4].map((semana) => (
        <section key={semana} aria-labelledby={`semana-${semana}`} className={styles.semana}>
          <h2 id={`semana-${semana}`} className={styles.semanaTitulo}>
            Semana {semana}
          </h2>
          <ul className={styles.grilla}>
            {(sesiones ?? [])
              .filter((s) => s.semana === semana)
              .map((s) => {
                const estado = completadas.has(s.id)
                  ? "hecho"
                  : activa && s.semana === asignacion.semana_actual && s.estimulo === asignacion.estimulo_actual
                    ? "sugerido"
                    : "pendiente";
                const { icono, texto } = ESTADOS[estado];
                return (
                  <li key={s.id}>
                    <Link
                      href={`/entrenar/${s.id}`}
                      className={`${styles.celda} ${styles[estado]}`}
                      aria-label={`Semana ${semana}, estímulo ${s.estimulo}: ${texto.toLowerCase()}${
                        estado === "hecho" ? ", ver lo que registraste" : ""
                      }`}
                    >
                      <span className={styles.numero}>E{s.estimulo}</span>
                      <span className={styles.estado}>
                        <span aria-hidden="true">{icono}</span> {texto}
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <section aria-labelledby="ciclo" className={styles.ciclo}>
        <h2 id="ciclo" className={styles.semanaTitulo}>
          ¿Terminaste con este plan?
        </h2>
        {solicitud?.length ? (
          <Mensaje tipo="exito">Ya pediste tu próximo ciclo, tu profe te lo va a asignar.</Mensaje>
        ) : (
          <PedirCiclo>
            <FormSolicitud asignacionId={asignacion.id} pendientes={activa ? pendientes : 0} />
          </PedirCiclo>
        )}
      </section>
    </Pantalla>
  );
}
