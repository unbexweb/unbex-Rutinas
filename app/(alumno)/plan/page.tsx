import Link from "next/link";
import { Mensaje } from "@/components/ui/Mensaje";
import { Pantalla } from "@/components/ui/Pantalla";
import { getAsignacion, hechos, posicion, SESIONES_POR_PLAN } from "@/lib/alumno/datos";
import { createClient } from "@/lib/supabase/server";
import styles from "./plan.module.css";

export const metadata = { title: "Mi plan · Unbex Rutinas" };

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
  const { data: sesiones } = await supabase
    .from("sesiones")
    .select("id, semana, estimulo")
    .eq("plan_id", asignacion.plan_id)
    .order("semana")
    .order("estimulo");

  const actual =
    asignacion.estado === "activa"
      ? posicion(asignacion.semana_actual, asignacion.estimulo_actual)
      : SESIONES_POR_PLAN + 1;
  const semanas = [1, 2, 3, 4];

  return (
    <Pantalla titulo="Mi plan">
      <p className={styles.resumen}>
        {hechos(asignacion)} de {SESIONES_POR_PLAN} entrenamientos hechos
      </p>
      {semanas.map((semana) => (
        <section key={semana} aria-labelledby={`semana-${semana}`}>
          <h2 id={`semana-${semana}`} className={styles.semana}>
            Semana {semana}
          </h2>
          <ul className={styles.grilla}>
            {(sesiones ?? [])
              .filter((s) => s.semana === semana)
              .map((s) => {
                const pos = posicion(s.semana, s.estimulo);
                const estado = pos < actual ? "hecho" : pos === actual ? "hoy" : "siguiente";
                const contenido = (
                  <>
                    <span className={styles.numero}>E{s.estimulo}</span>
                    <span className={styles.estado}>
                      {estado === "hecho" ? "✓ Hecho" : estado === "hoy" ? "Te toca" : "Pendiente"}
                    </span>
                  </>
                );
                return (
                  <li key={s.id}>
                    {estado === "siguiente" ? (
                      <span className={`${styles.celda} ${styles.siguiente}`} aria-disabled="true">
                        {contenido}
                      </span>
                    ) : (
                      <Link
                        href={`/entrenar/${s.id}`}
                        className={`${styles.celda} ${styles[estado]}`}
                        aria-label={`Semana ${semana}, estímulo ${s.estimulo}: ${
                          estado === "hecho" ? "hecho, ver lo que registraste" : "te toca"
                        }`}
                      >
                        {contenido}
                      </Link>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </Pantalla>
  );
}
