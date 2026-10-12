"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Boton } from "@/components/ui/Boton";
import { Mensaje } from "@/components/ui/Mensaje";
import type { EntrenamientoVista, EjercicioVista, ItemVista, SerieVista } from "@/lib/alumno/entrenar-tipos";
import { guardarEjercicio, terminarEntrenamiento } from "./actions";
import styles from "./entrenamiento.module.css";

const YOUTUBE_ID = /^[\w-]{11}$/;

function Video({ ejercicio }: { ejercicio: EjercicioVista }) {
  const [visible, setVisible] = useState(false);
  const embebible = ejercicio.youtubeId && YOUTUBE_ID.test(ejercicio.youtubeId);
  if (!embebible && !ejercicio.videoUrl) return null;

  if (!embebible) {
    return (
      <a className={styles.verVideo} href={ejercicio.videoUrl!} target="_blank" rel="noopener noreferrer">
        Ver video
      </a>
    );
  }
  // El reproductor recién se carga al tocar, para no gastar datos.
  return visible ? (
    <div className={styles.video}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${ejercicio.youtubeId}`}
        title={`Video: ${ejercicio.nombre}`}
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  ) : (
    <button type="button" className={styles.verVideo} onClick={() => setVisible(true)}>
      Ver video
    </button>
  );
}

function resumenSeries(series: SerieVista[]): string {
  const hechas = series
    .map((s, i) => ({ ...s, n: i + 1 }))
    .filter((s) => s.peso || s.reps)
    .map((s) => `${s.peso ? `${s.peso} kg` : "—"} × ${s.reps || "—"}`);
  return hechas.length ? hechas.join(" · ") : "Sin registrar";
}

export function Entrenamiento({ vista }: { vista: EntrenamientoVista }) {
  const router = useRouter();
  const { items, modo } = vista;
  const editable = modo === "editar";

  const [paso, setPaso] = useState(0);
  const [elegidos, setElegidos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((it) => {
        const previo = it.guardado.ejercicioUsadoId;
        const valido = previo === it.ejercicio.id || previo === it.alternativa?.id;
        return [it.beId, valido && previo ? previo : it.ejercicio.id];
      }),
    ),
  );
  const [valores, setValores] = useState<Record<string, SerieVista[]>>(() =>
    Object.fromEntries(items.map((it) => [it.beId, it.guardado.series])),
  );
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  const enResumen = paso >= items.length;
  const item: ItemVista | undefined = items[paso];

  function cambiarValor(beId: string, i: number, campo: keyof SerieVista, valor: string) {
    setValores((v) => ({
      ...v,
      [beId]: (v[beId] ?? []).map((s, j) => (j === i ? { ...s, [campo]: valor } : s)),
    }));
  }

  function siguiente() {
    if (!item) return;
    setError(null);
    if (!editable || !item.registraCarga) {
      setPaso(paso + 1);
      return;
    }
    empezar(async () => {
      const res = await guardarEjercicio({
        asignacionId: vista.asignacionId,
        sesionId: vista.sesionId,
        beId: item.beId,
        ejercicioUsadoId: elegidos[item.beId] ?? item.ejercicio.id,
        series: valores[item.beId] ?? [],
      }).catch(() => ({ ok: false as const, error: "No pudimos guardar. Revisá tu conexión y probá de nuevo." }));
      // Si falla, se queda en esta pantalla con todo lo escrito.
      if (res.ok) setPaso(paso + 1);
      else setError(res.error);
    });
  }

  function terminar() {
    setError(null);
    empezar(async () => {
      const res = await terminarEntrenamiento(vista.asignacionId, vista.sesionId).catch(() => ({
        ok: false as const,
        error: "No pudimos cerrar el entrenamiento. Revisá tu conexión y probá de nuevo.",
      }));
      if (res.ok) {
        router.push("/inicio");
        router.refresh();
      } else setError(res.error);
    });
  }

  const titulo = `Semana ${vista.semana} · Estímulo ${vista.estimulo}`;

  if (enResumen) {
    return (
      <main className={styles.pantalla}>
        <p className={styles.sesion}>{titulo}</p>
        <h1 className={styles.titulo}>{editable ? "¡Muy bien!" : "Lo que registraste"}</h1>
        <ul className={styles.resumen}>
          {items
            .filter((it) => it.registraCarga)
            .map((it) => {
              const usado = [it.ejercicio, it.alternativa].find((e) => e?.id === elegidos[it.beId]) ?? it.ejercicio;
              return (
                <li key={it.beId} className={styles.resumenItem}>
                  <strong>{usado.nombre}</strong>
                  <span>{resumenSeries(valores[it.beId] ?? [])}</span>
                </li>
              );
            })}
        </ul>
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <div className={styles.barra}>
          <Boton variante="secundario" type="button" onClick={() => setPaso(items.length - 1)} disabled={ocupado}>
            Anterior
          </Boton>
          {editable ? (
            <Boton type="button" onClick={terminar} cargando={ocupado}>
              Terminé
            </Boton>
          ) : (
            <Boton href="/plan">Volver al plan</Boton>
          )}
        </div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className={styles.pantalla}>
        <Mensaje>Este entrenamiento todavía no tiene ejercicios cargados.</Mensaje>
        <Boton href="/plan">Volver al plan</Boton>
      </main>
    );
  }

  const usadoId = elegidos[item.beId] ?? item.ejercicio.id;
  const usado = item.alternativa && item.alternativa.id === usadoId ? item.alternativa : item.ejercicio;
  const ultima = item.ultima[usadoId];

  return (
    <main className={styles.pantalla}>
      <p className={styles.sesion}>
        {titulo} · Ejercicio {paso + 1} de {items.length}
      </p>
      <header className={styles.bloque}>
        <h2 className={styles.bloqueNombre}>{item.bloqueNombre}</h2>
        {item.bloqueIndicacion && <p>{item.bloqueIndicacion}</p>}
      </header>

      <section className={styles.ejercicio}>
        <h1 className={styles.titulo}>{usado.nombre}</h1>
        <dl className={styles.datos}>
          {item.series && (
            <div>
              <dt>Series</dt>
              <dd>{item.series}</dd>
            </div>
          )}
          {item.reps && (
            <div>
              <dt>Reps</dt>
              <dd>{item.reps}</dd>
            </div>
          )}
          {item.cargaSugerida && (
            <div>
              <dt>Carga</dt>
              <dd>{item.cargaSugerida}</dd>
            </div>
          )}
        </dl>
        {item.nota && <p className={styles.nota}>{item.nota}</p>}

        {item.alternativa && (
          <fieldset className={styles.alternativas} disabled={!editable}>
            <legend>¿Cuál hiciste?</legend>
            {[item.ejercicio, item.alternativa].map((e) => (
              <button
                key={e.id}
                type="button"
                className={`${styles.alternativa} ${e.id === usadoId ? styles.elegida : ""}`}
                aria-pressed={e.id === usadoId}
                onClick={() => setElegidos((x) => ({ ...x, [item.beId]: e.id }))}
              >
                {e.nombre}
              </button>
            ))}
          </fieldset>
        )}

        <Video key={usado.id} ejercicio={usado} />
      </section>

      {item.registraCarga && (
        <section className={styles.series} aria-label="Registro de series">
          {editable && (
            <p className={styles.ultima}>
              {ultima ? `La última vez: ${ultima}` : "Todavía no lo registraste antes."}
            </p>
          )}
          {(valores[item.beId] ?? []).map((serie, i) => (
            <div key={i} className={styles.fila}>
              <span className={styles.serieN}>Serie {i + 1}</span>
              {editable ? (
                <>
                  <label className={styles.campo}>
                    <span>Peso (kg)</span>
                    <input
                      inputMode="decimal"
                      autoComplete="off"
                      value={serie.peso}
                      onChange={(e) => cambiarValor(item.beId, i, "peso", e.target.value)}
                    />
                  </label>
                  <label className={styles.campo}>
                    <span>Reps</span>
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      value={serie.reps}
                      onChange={(e) => cambiarValor(item.beId, i, "reps", e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <span className={styles.leido}>
                  {serie.peso || serie.reps ? `${serie.peso ? `${serie.peso} kg` : "—"} × ${serie.reps || "—"}` : "Sin registrar"}
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      {error && <Mensaje tipo="error">{error}</Mensaje>}

      <div className={styles.barra}>
        {paso > 0 ? (
          <Boton variante="secundario" type="button" onClick={() => { setError(null); setPaso(paso - 1); }} disabled={ocupado}>
            Anterior
          </Boton>
        ) : (
          <Link href={editable ? "/inicio" : "/plan"} className={styles.salir}>
            Salir
          </Link>
        )}
        <Boton type="button" onClick={siguiente} cargando={ocupado}>
          Siguiente
        </Boton>
      </div>
    </main>
  );
}
