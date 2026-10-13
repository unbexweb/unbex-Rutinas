"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Boton } from "@/components/ui/Boton";
import { Mensaje } from "@/components/ui/Mensaje";
import type { EjercicioVista, EntrenamientoVista, ItemVista, SerieVista } from "@/lib/alumno/entrenar-tipos";
import { guardarEjercicio, marcarEjercicio, terminarEntrenamiento } from "./actions";
import styles from "./entrenamiento.module.css";

const YOUTUBE_ID = /^[\w-]{11}$/;
const ERROR_RED = "No pudimos guardar. Revisá tu conexión y probá de nuevo.";

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

// "3 × 6/8" y la carga, tal cual los cargó el profe.
function detalleDe(it: ItemVista): string {
  const sxr = it.series && it.reps ? `${it.series} × ${it.reps}` : it.series ? `${it.series} series` : it.reps ? `${it.reps} reps` : "";
  return [sxr, it.cargaSugerida].filter(Boolean).join(" · ");
}

const textoSerie = (s: SerieVista) =>
  s.peso || s.reps ? `${s.peso ? `${s.peso} kg` : "—"} × ${s.reps || "—"}` : "Sin registrar";

export function Entrenamiento({ vista }: { vista: EntrenamientoVista }) {
  const router = useRouter();
  const { items } = vista;
  const editable = vista.modo === "editar";

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
  const [hechos, setHechos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((it) => [it.beId, it.guardado.hecho])),
  );
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<{ beId: string | null; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null); // ejercicio guardándose
  const [terminando, empezar] = useTransition();
  // Lo último que se sabe guardado en la base, para no guardar de más.
  const guardado = useRef<Record<string, string>>(
    Object.fromEntries(items.map((it) => [it.beId, JSON.stringify(it.guardado.series)])),
  );

  const cantidadHechos = items.filter((it) => hechos[it.beId]).length;
  const grupos = items.reduce<{ id: string; nombre: string; indicacion: string | null; items: ItemVista[] }[]>(
    (acc, it) => {
      const ultimo = acc[acc.length - 1];
      if (ultimo?.id === it.bloqueId) ultimo.items.push(it);
      else acc.push({ id: it.bloqueId, nombre: it.bloqueNombre, indicacion: it.bloqueIndicacion, items: [it] });
      return acc;
    },
    [],
  );

  const sucio = (it: ItemVista) => JSON.stringify(valores[it.beId] ?? []) !== guardado.current[it.beId];

  async function guardarSerie(it: ItemVista, marcarHecho: boolean): Promise<boolean> {
    const series = valores[it.beId] ?? [];
    const res = await guardarEjercicio({
      asignacionId: vista.asignacionId,
      sesionId: vista.sesionId,
      beId: it.beId,
      ejercicioUsadoId: elegidos[it.beId] ?? it.ejercicio.id,
      series,
      marcarHecho,
    }).catch(() => ({ ok: false as const, error: ERROR_RED }));
    if (res.ok) {
      guardado.current[it.beId] = JSON.stringify(series);
      return true;
    }
    setError({ beId: it.beId, texto: res.error });
    return false;
  }

  // Al pasar a otro ejercicio se guarda en silencio lo que había escrito (sin marcarlo como hecho).
  function guardarSiHaceFalta(beId: string | null) {
    const it = items.find((x) => x.beId === beId);
    if (!editable || !it || !it.registraCarga || !sucio(it)) return;
    void guardarSerie(it, false);
  }

  function tocar(it: ItemVista) {
    setError(null);
    if (it.registraCarga) {
      guardarSiHaceFalta(abierto);
      setAbierto(abierto === it.beId ? null : it.beId);
      return;
    }
    if (!editable) return;
    const nuevo = !hechos[it.beId];
    setHechos((h) => ({ ...h, [it.beId]: nuevo }));
    void marcarEjercicio({
      asignacionId: vista.asignacionId,
      sesionId: vista.sesionId,
      beId: it.beId,
      hecho: nuevo,
    })
      .catch(() => ({ ok: false as const, error: ERROR_RED }))
      .then((res) => {
        if (res.ok) return;
        setHechos((h) => ({ ...h, [it.beId]: !nuevo })); // vuelve a como estaba
        setError({ beId: null, texto: res.error });
      });
  }

  async function listo(it: ItemVista) {
    setError(null);
    setOcupado(it.beId);
    const ok = await guardarSerie(it, true);
    setOcupado(null);
    if (ok) {
      setHechos((h) => ({ ...h, [it.beId]: true }));
      setAbierto(null);
    }
  }

  function cambiarValor(beId: string, i: number, campo: keyof SerieVista, valor: string) {
    setValores((v) => ({ ...v, [beId]: (v[beId] ?? []).map((s, j) => (j === i ? { ...s, [campo]: valor } : s)) }));
  }

  function terminar() {
    setError(null);
    const faltan = items.length - cantidadHechos;
    if (faltan > 0 && !window.confirm(`Te faltan ${faltan} ${faltan === 1 ? "ejercicio" : "ejercicios"}. ¿Terminar igual?`)) {
      return;
    }
    empezar(async () => {
      // Si dejó un ejercicio abierto con cosas escritas, se guardan antes de cerrar.
      const abiertoItem = items.find((x) => x.beId === abierto);
      if (abiertoItem?.registraCarga && sucio(abiertoItem) && !(await guardarSerie(abiertoItem, false))) return;

      const res = await terminarEntrenamiento(vista.asignacionId, vista.sesionId).catch(() => ({
        ok: false as const,
        error: "No pudimos cerrar el entrenamiento. Revisá tu conexión y probá de nuevo.",
      }));
      if (res.ok) {
        router.push("/inicio");
        router.refresh();
      } else setError({ beId: null, texto: res.error });
    });
  }

  if (!items.length) {
    return (
      <main className={styles.pantalla}>
        <Mensaje>Este entrenamiento todavía no tiene ejercicios cargados.</Mensaje>
        <Boton href="/plan">Volver al plan</Boton>
      </main>
    );
  }

  return (
    <main className={styles.pantalla}>
      <header className={styles.encabezado}>
        <h1 className={styles.titulo}>
          Semana {vista.semana} · Estímulo {vista.estimulo}
        </h1>
        <p className={styles.avance}>
          {cantidadHechos} de {items.length} hechos
        </p>
        <progress className={styles.barraAvance} value={cantidadHechos} max={items.length} aria-label="Avance" />
        {!editable && <p className={styles.lectura}>Entrenamiento ya hecho: lo que registraste.</p>}
      </header>

      {error && !error.beId && <Mensaje tipo="error">{error.texto}</Mensaje>}

      {grupos.map((g) => (
        <section key={g.id} className={styles.grupo} aria-labelledby={`b-${g.id}`}>
          <h2 id={`b-${g.id}`} className={styles.grupoTitulo}>
            {g.nombre}
          </h2>
          {g.indicacion && <p className={styles.indicacion}>{g.indicacion}</p>}
          <ul className={styles.lista}>
            {g.items.map((it) => {
              const usadoId = elegidos[it.beId] ?? it.ejercicio.id;
              const usado = it.alternativa && it.alternativa.id === usadoId ? it.alternativa : it.ejercicio;
              const hecho = Boolean(hechos[it.beId]);
              const abiertoAca = abierto === it.beId;
              const detalle = detalleDe(it);
              const contenido = (
                <>
                  <span className={`${styles.check} ${hecho ? styles.checkHecho : ""}`} aria-hidden="true">
                    {hecho ? "✓" : ""}
                  </span>
                  <span className={styles.textoFila}>
                    <span className={styles.nombre}>{usado.nombre}</span>
                    {detalle && <span className={styles.detalle}>{detalle}</span>}
                    {!it.registraCarga && it.nota && <span className={styles.detalle}>{it.nota}</span>}
                  </span>
                  {it.registraCarga && (
                    <span className={styles.flecha} aria-hidden="true">
                      {abiertoAca ? "▴" : "▾"}
                    </span>
                  )}
                </>
              );
              const clase = `${styles.fila} ${hecho ? styles.filaHecha : ""}`;
              const estado = hecho ? ", hecho" : ", sin hacer";

              return (
                <li key={it.beId} className={styles.item}>
                  {!it.registraCarga && !editable ? (
                    <div className={clase}>
                      {contenido}
                      <span className={styles.soloLectura}>{estado.slice(2)}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={clase}
                      onClick={() => tocar(it)}
                      aria-expanded={it.registraCarga ? abiertoAca : undefined}
                      aria-pressed={it.registraCarga ? undefined : hecho}
                      aria-label={it.registraCarga ? `${usado.nombre}${detalle ? `, ${detalle}` : ""}${estado}` : undefined}
                    >
                      {contenido}
                    </button>
                  )}

                  {abiertoAca && it.registraCarga && (
                    <div className={styles.panel}>
                      {it.nota && <p className={styles.nota}>{it.nota}</p>}

                      {it.alternativa && (
                        <fieldset className={styles.alternativas} disabled={!editable}>
                          <legend>¿Cuál hiciste?</legend>
                          {[it.ejercicio, it.alternativa].map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              className={`${styles.alternativa} ${e.id === usadoId ? styles.elegida : ""}`}
                              aria-pressed={e.id === usadoId}
                              onClick={() => setElegidos((x) => ({ ...x, [it.beId]: e.id }))}
                            >
                              {e.nombre}
                            </button>
                          ))}
                        </fieldset>
                      )}

                      <Video key={usado.id} ejercicio={usado} />

                      {editable && (
                        <p className={styles.ultima}>
                          {it.ultima[usadoId] ? `La última vez: ${it.ultima[usadoId]}` : "Todavía no lo registraste antes."}
                        </p>
                      )}

                      <div className={styles.series}>
                        {(valores[it.beId] ?? []).map((serie, i) => (
                          <div key={i} className={styles.filaSerie}>
                            <span className={styles.serieN}>Serie {i + 1}</span>
                            {editable ? (
                              <>
                                <label className={styles.campo}>
                                  <span>Peso (kg)</span>
                                  <input
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={serie.peso}
                                    onChange={(ev) => cambiarValor(it.beId, i, "peso", ev.target.value)}
                                  />
                                </label>
                                <label className={styles.campo}>
                                  <span>Reps</span>
                                  <input
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={serie.reps}
                                    onChange={(ev) => cambiarValor(it.beId, i, "reps", ev.target.value)}
                                  />
                                </label>
                              </>
                            ) : (
                              <span className={styles.leido}>{textoSerie(serie)}</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {error?.beId === it.beId && <Mensaje tipo="error">{error.texto}</Mensaje>}

                      {editable && (
                        <Boton type="button" onClick={() => listo(it)} cargando={ocupado === it.beId}>
                          Listo
                        </Boton>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className={styles.barra}>
        {editable ? (
          <Boton type="button" onClick={terminar} cargando={terminando}>
            Terminé
          </Boton>
        ) : (
          <Boton href="/plan">Volver al plan</Boton>
        )}
      </div>
    </main>
  );
}
