import { BotonCerrarSesion } from "@/components/ui/BotonCerrarSesion";
import { Boton } from "@/components/ui/Boton";
import { Mensaje } from "@/components/ui/Mensaje";
import { Pantalla } from "@/components/ui/Pantalla";
import { getAsignacion, hechos, SESIONES_POR_PLAN } from "@/lib/alumno/datos";
import { getUsuario } from "@/lib/auth/usuario";
import { createClient } from "@/lib/supabase/server";
import { FormSolicitud } from "./form-solicitud";
import styles from "./inicio.module.css";

export const metadata = { title: "Inicio · Unbex Rutinas" };

export default async function InicioAlumnoPage() {
  const usuario = await getUsuario();
  const asignacion = await getAsignacion();
  const titulo = `¡Hola, ${usuario?.profile.nombre}!`;

  if (!asignacion) {
    return (
      <Pantalla titulo={titulo}>
        <Mensaje>Todavía no tenés un plan asignado. Hablá con tu profe.</Mensaje>
        <BotonCerrarSesion />
      </Pantalla>
    );
  }

  const supabase = await createClient();

  if (asignacion.estado === "finalizada") {
    const { data: pendiente } = await supabase
      .from("solicitudes_ciclo")
      .select("id")
      .eq("asignacion_id", asignacion.id)
      .eq("estado", "pendiente")
      .limit(1);

    return (
      <Pantalla titulo={titulo}>
        <section className={styles.tarjeta}>
          <h2 className={styles.tarjetaTitulo}>¡Terminaste el plan!</h2>
          <p className={styles.progreso}>
            {SESIONES_POR_PLAN} de {SESIONES_POR_PLAN} entrenamientos
          </p>
        </section>
        {pendiente?.length ? (
          <Mensaje tipo="exito">Ya pediste tu próximo ciclo, tu profe te lo va a asignar.</Mensaje>
        ) : (
          <FormSolicitud asignacionId={asignacion.id} />
        )}
        <BotonCerrarSesion />
      </Pantalla>
    );
  }

  const { data: sesion } = await supabase
    .from("sesiones")
    .select("id")
    .eq("plan_id", asignacion.plan_id)
    .eq("semana", asignacion.semana_actual)
    .eq("estimulo", asignacion.estimulo_actual)
    .maybeSingle();

  return (
    <Pantalla titulo={titulo}>
      <section className={styles.tarjeta}>
        <p className={styles.etiqueta}>Te toca:</p>
        <h2 className={styles.tarjetaTitulo}>
          Semana {asignacion.semana_actual} · Estímulo {asignacion.estimulo_actual}
        </h2>
        <p className={styles.progreso}>
          {hechos(asignacion)} de {SESIONES_POR_PLAN} entrenamientos
        </p>
        <progress
          className={styles.barra}
          value={hechos(asignacion)}
          max={SESIONES_POR_PLAN}
          aria-label="Progreso del plan"
        />
        {sesion && <Boton href={`/entrenar/${sesion.id}`}>Empezar</Boton>}
      </section>
      <BotonCerrarSesion />
    </Pantalla>
  );
}
