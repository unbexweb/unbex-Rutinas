import { FormSolicitud } from "@/components/alumno/FormSolicitud";
import { AvisoInstalar } from "@/components/pwa/AvisoInstalar";
import { Boton } from "@/components/ui/Boton";
import { BotonCerrarSesion } from "@/components/ui/BotonCerrarSesion";
import { Mensaje } from "@/components/ui/Mensaje";
import { Pantalla } from "@/components/ui/Pantalla";
import { getAsignacion, getProgreso, SESIONES_POR_PLAN } from "@/lib/alumno/datos";
import { getUsuario } from "@/lib/auth/usuario";
import { createClient } from "@/lib/supabase/server";
import styles from "./inicio.module.css";

export const metadata = { title: "Inicio · Unbex Rutinas" };

export default async function InicioAlumnoPage() {
  const usuario = await getUsuario();
  const asignacion = await getAsignacion();
  const titulo = `¡Hola, ${usuario?.profile.nombre}!`;

  if (!asignacion) {
    return (
      <Pantalla titulo={titulo}>
        <AvisoInstalar />
        <Mensaje>Todavía no tenés un plan asignado. Hablá con tu profe.</Mensaje>
        <BotonCerrarSesion />
      </Pantalla>
    );
  }

  const supabase = await createClient();
  const { hechos } = await getProgreso(asignacion.id);

  if (asignacion.estado === "finalizada") {
    const { data: pendiente } = await supabase
      .from("solicitudes_ciclo")
      .select("id")
      .eq("asignacion_id", asignacion.id)
      .eq("estado", "pendiente")
      .limit(1);
    const completo = hechos >= SESIONES_POR_PLAN;

    return (
      <Pantalla titulo={titulo}>
        <AvisoInstalar />
        <section className={styles.tarjeta}>
          <h2 className={styles.tarjetaTitulo}>{completo ? "¡Terminaste el plan!" : "Cerraste este plan"}</h2>
          <p className={styles.progreso}>
            {hechos} de {SESIONES_POR_PLAN} entrenamientos
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

  // El plan es libre: semana_actual/estimulo_actual son el primer pendiente, o sea el sugerido.
  const { data: sesion } = await supabase
    .from("sesiones")
    .select("id")
    .eq("plan_id", asignacion.plan_id)
    .eq("semana", asignacion.semana_actual)
    .eq("estimulo", asignacion.estimulo_actual)
    .maybeSingle();

  return (
    <Pantalla titulo={titulo}>
      <AvisoInstalar />
      <section className={styles.tarjeta}>
        <p className={styles.etiqueta}>Te sugerimos:</p>
        <h2 className={styles.tarjetaTitulo}>
          Semana {asignacion.semana_actual} · Estímulo {asignacion.estimulo_actual}
        </h2>
        <p className={styles.progreso}>
          {hechos} de {SESIONES_POR_PLAN} entrenamientos
        </p>
        <progress className={styles.barra} value={hechos} max={SESIONES_POR_PLAN} aria-label="Progreso del plan" />
        {sesion && <Boton href={`/entrenar/${sesion.id}`}>Empezar</Boton>}
      </section>
      <Boton href="/plan" variante="secundario">
        Elegir otro entrenamiento
      </Boton>
      <BotonCerrarSesion />
    </Pantalla>
  );
}
