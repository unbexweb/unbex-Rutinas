"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { Boton } from "@/components/ui/Boton";
import { Mensaje } from "@/components/ui/Mensaje";
import type { EjercicioVista, EntrenamientoVista, ItemVista, SerieVista } from "@/lib/alumno/entrenar-tipos";
import { guardarSerie, marcarEjercicio, terminarEntrenamiento } from "./actions";
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

// "3 × 6/8", tal cual lo cargó el profe.
function seriesPorReps(it: ItemVista): string {
  if (it.series && it.reps) return `${it.series} × ${it.reps}`;
  if (it.series) return `${it.series} series`;
  return it.reps ? `${it.reps} reps` : "";
}

const colorDeGrupo = (letra: string): CSSProperties =>
  ({ "--color-grupo": `var(--color-grupo-${"abcd"[(letra.charCodeAt(0) - 65) % 4]})` }) as CSSProperties;

type Segmento = { grupo: string | null; items: ItemVista[] };

// Dentro de cada bloque, los ejercicios con el mismo grupo forman una super serie (se agrupan donde aparece el primero).
function segmentosDe(items: ItemVista[]): Segmento[] {
  const vistos = new Set<string>();
  const out: Segmento[] = [];
  for (const it of items) {
    if (!it.grupo) out.push({ grupo: null, items: [it] });
    else if (!vistos.has(it.grupo)) {
      vistos.add(it.grupo);
      out.push({ grupo: it.grupo, items: items.filter((x) => x.grupo === it.grupo) });
    }
  }
  return out;
}

type Borrador = { v: Record<string, { peso: string; reps: string }[]>; e: Record<string, string> };

export function Entrenamiento({ vista }: { vista: EntrenamientoVista }) {
  const router = useRouter();
  const { items } = vista;
  const editable = vista.modo === "editar";
  const claveBorrador = `unbex:borrador:${vista.asignacionId}:${vista.sesionId}`;

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
  // Ejercicios sin carga: un toque los marca.
  const [marcados, setMarcados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((it) => [it.beId, !it.registraCarga && it.guardado.hecho])),
  );
  // Con carga y marcados con el diseño anterior (sin series tildadas): siguen contando como hechos hasta que toque una serie.
  const [heredados, setHeredados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      items.map((it) => [it.beId, it.registraCarga && it.guardado.hecho && !it.guardado.series.every((s) => s.hecha)]),
    ),
  );
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<{ beId: string | null; texto: string } | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null); // "beId:indice"
  const [terminando, empezar] = useTransition();
  const [restaurado, setRestaurado] = useState(false);
  // Lo último que se sabe guardado de cada serie, para no guardar de más.
  const guardado = useRef<Record<string, string>>(
    Object.fromEntries(
      items.flatMap((it) =>
        it.guardado.series.map((s, i) => [`${it.beId}:${i}`, JSON.stringify([s.peso, s.reps, s.hecha])] as const),
      ),
    ),
  );

  // ---- borrador: lo escrito y sin tildar se guarda en el celular y se recupera si se recarga la página
  useEffect(() => {
    if (!editable) return;
    try {
      const raw = localStorage.getItem(claveBorrador);
      if (raw) {
        const b = JSON.parse(raw) as Borrador;
        setValores((actual) =>
          Object.fromEntries(
            Object.entries(actual).map(([beId, series]) => [
              beId,
              series.map((s, i) => {
                const d = b.v?.[beId]?.[i];
                // Lo tildado ya está guardado en la base: manda la base.
                return !s.hecha && d && (d.peso || d.reps) ? { ...s, peso: d.peso, reps: d.reps } : s;
              }),
            ]),
          ),
        );
        setElegidos((actual) =>
          Object.fromEntries(
            Object.entries(actual).map(([beId, id]) => {
              const it = items.find((x) => x.beId === beId);
              const elegido = b.e?.[beId];
              const valido = elegido === it?.ejercicio.id || elegido === it?.alternativa?.id;
              return [beId, valido && elegido && !it?.guardado.series.some((s) => s.hecha) ? elegido : id];
            }),
          ),
        );
      }
    } catch {
      // sin localStorage (modo privado) o borrador roto: se sigue sin borrador
    }
    setRestaurado(true);
    // solo al abrir la pantalla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editable || !restaurado) return;
    try {
      const b: Borrador = {
        v: Object.fromEntries(
          Object.entries(valores).map(([beId, series]) => [beId, series.map((s) => ({ peso: s.peso, reps: s.reps }))]),
        ),
        e: elegidos,
      };
      localStorage.setItem(claveBorrador, JSON.stringify(b));
    } catch {
      // sin espacio o sin localStorage: no pasa nada, solo no hay borrador
    }
  }, [valores, elegidos, restaurado, editable, claveBorrador]);

  const hechoDe = (it: ItemVista) =>
    it.registraCarga
      ? (valores[it.beId] ?? []).every((s) => s.hecha) || Boolean(heredados[it.beId])
      : Boolean(marcados[it.beId]);
  const cantidadHechos = items.filter(hechoDe).length;

  const bloques = items.reduce<{ id: string; nombre: string; indicacion: string | null; items: ItemVista[] }[]>(
    (acc, it) => {
      const ultimo = acc[acc.length - 1];
      if (ultimo?.id === it.bloqueId) ultimo.items.push(it);
      else acc.push({ id: it.bloqueId, nombre: it.bloqueNombre, indicacion: it.bloqueIndicacion, items: [it] });
      return acc;
    },
    [],
  );

  function cambiarSerie(beId: string, i: number, cambios: Partial<SerieVista>) {
    setValores((v) => ({ ...v, [beId]: (v[beId] ?? []).map((s, j) => (j === i ? { ...s, ...cambios } : s)) }));
  }

  async function guardarFila(it: ItemVista, i: number, s: SerieVista) {
    const clave = `${it.beId}:${i}`;
    setGuardando(clave);
    const res = await guardarSerie({
      asignacionId: vista.asignacionId,
      sesionId: vista.sesionId,
      beId: it.beId,
      ejercicioUsadoId: elegidos[it.beId] ?? it.ejercicio.id,
      nSerie: i + 1,
      totalSeries: it.nSeries,
      peso: s.peso,
      reps: s.reps,
      hecha: s.hecha,
    }).catch(() => ({ ok: false as const, error: ERROR_RED }));
    setGuardando(null);
    if (res.ok) guardado.current[clave] = JSON.stringify([s.peso, s.reps, s.hecha]);
    else setError({ beId: it.beId, texto: res.error });
    return res.ok;
  }

  // Cada tilde guarda en la base. Si falla, vuelve a como estaba y avisa (lo escrito no se pierde).
  async function tildar(it: ItemVista, i: number) {
    const actual = valores[it.beId]?.[i];
    if (!actual || guardando) return;
    setError(null);
    const nueva = { ...actual, hecha: !actual.hecha };
    cambiarSerie(it.beId, i, { hecha: nueva.hecha });
    setHeredados((h) => ({ ...h, [it.beId]: false }));
    if (!(await guardarFila(it, i, nueva))) cambiarSerie(it.beId, i, { hecha: actual.hecha });
  }

  // Si cambia lo escrito en una serie ya tildada, se vuelve a guardar al salir del campo.
  function alSalirDeCampo(it: ItemVista, i: number) {
    const s = valores[it.beId]?.[i];
    if (!s?.hecha || guardando) return;
    if (guardado.current[`${it.beId}:${i}`] === JSON.stringify([s.peso, s.reps, s.hecha])) return;
    void guardarFila(it, i, s);
  }

  function tocar(it: ItemVista) {
    setError(null);
    if (it.registraCarga) {
      setAbierto(abierto === it.beId ? null : it.beId);
      return;
    }
    if (!editable) return;
    const nuevo = !marcados[it.beId];
    setMarcados((m) => ({ ...m, [it.beId]: nuevo }));
    void marcarEjercicio({
      asignacionId: vista.asignacionId,
      sesionId: vista.sesionId,
      beId: it.beId,
      hecho: nuevo,
    })
      .catch(() => ({ ok: false as const, error: ERROR_RED }))
      .then((res) => {
        if (res.ok) return;
        setMarcados((m) => ({ ...m, [it.beId]: !nuevo })); // vuelve a como estaba
        setError({ beId: null, texto: res.error });
      });
  }

  function terminar() {
    setError(null);
    const faltan = items.length - cantidadHechos;
    if (faltan > 0 && !window.confirm(`Te faltan ${faltan} ${faltan === 1 ? "ejercicio" : "ejercicios"}. ¿Terminar igual?`)) {
      return;
    }
    empezar(async () => {
      const res = await terminarEntrenamiento(vista.asignacionId, vista.sesionId).catch(() => ({
        ok: false as const,
        error: "No pudimos cerrar el entrenamiento. Revisá tu conexión y probá de nuevo.",
      }));
      if (res.ok) {
        try {
          localStorage.removeItem(claveBorrador);
        } catch {
          // nada que limpiar
        }
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

  // Función común (no un componente): si fuera un componente definido acá adentro, se recrearía en cada tecla y los campos perderían el foco.
  function renderFila(it: ItemVista, numero: string | null) {
    const usadoId = elegidos[it.beId] ?? it.ejercicio.id;
    const usado = it.alternativa && it.alternativa.id === usadoId ? it.alternativa : it.ejercicio;
    const hecho = hechoDe(it);
    const abiertoAca = abierto === it.beId;
    const sxr = seriesPorReps(it);
    const interactiva = it.registraCarga || editable;
    const estado = hecho ? "hecho" : "sin hacer";

    const contenido = (
      <>
        <span className={`${styles.check} ${hecho ? styles.checkHecho : ""}`} aria-hidden="true">
          {hecho ? "✓" : ""}
        </span>
        <span className={styles.textoFila}>
          <span className={styles.nombre}>
            {numero && <span className={styles.numero}>{numero}</span>}
            {usado.nombre}
          </span>
          {(sxr || it.cargaSugerida) && (
            <span className={styles.chips}>
              {sxr && <span className={styles.chip}>{sxr}</span>}
              {it.cargaSugerida && <span className={styles.chip}>{it.cargaSugerida}</span>}
            </span>
          )}
          {!it.registraCarga && it.nota && <span className={styles.notaFila}>{it.nota}</span>}
        </span>
        {it.registraCarga && (
          <span className={styles.flecha} aria-hidden="true">
            {abiertoAca ? "▴" : "▾"}
          </span>
        )}
      </>
    );

    const anterior = it.anterior[usadoId] ?? [];

    return (
      <li className={styles.item}>
        {interactiva ? (
          <button
            type="button"
            className={`${styles.fila} ${hecho ? styles.filaHecha : ""}`}
            onClick={() => tocar(it)}
            aria-expanded={it.registraCarga ? abiertoAca : undefined}
            aria-pressed={it.registraCarga ? undefined : hecho}
            aria-label={`${numero ? `${numero}, ` : ""}${usado.nombre}${sxr ? `, ${sxr}` : ""}${
              it.cargaSugerida ? `, ${it.cargaSugerida}` : ""
            }, ${estado}`}
          >
            {contenido}
          </button>
        ) : (
          <div className={`${styles.fila} ${hecho ? styles.filaHecha : ""}`}>
            {contenido}
            <span className="sr-only">{estado}</span>
          </div>
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

            <table className={styles.tabla}>
              <caption className="sr-only">Series de {usado.nombre}</caption>
              <thead>
                <tr>
                  <th scope="col">Serie</th>
                  <th scope="col">Anterior</th>
                  <th scope="col">Kg</th>
                  <th scope="col">Reps</th>
                  <th scope="col">
                    <span aria-hidden="true">✓</span>
                    <span className="sr-only">Hecha</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(valores[it.beId] ?? []).map((serie, i) => {
                  const previa = anterior[i];
                  const idKg = `${it.beId}-kg-${i}`;
                  const idReps = `${it.beId}-reps-${i}`;
                  return (
                    <tr key={i} className={serie.hecha ? styles.serieHecha : undefined}>
                      <th scope="row" className={styles.serieN}>
                        {i + 1}
                      </th>
                      <td>
                        {editable && previa && (previa.peso || previa.reps) ? (
                          <button
                            type="button"
                            className={styles.anterior}
                            aria-label={`Copiar lo de la última vez: ${previa.peso || "sin peso"} kilos, ${previa.reps || "sin"} repeticiones`}
                            onClick={() => cambiarSerie(it.beId, i, { peso: previa.peso, reps: previa.reps })}
                          >
                            {previa.peso || "—"} × {previa.reps || "—"}
                          </button>
                        ) : (
                          <span className={styles.sinDato}>—</span>
                        )}
                      </td>
                      <td>
                        <label htmlFor={idKg} className="sr-only">
                          Kilos de la serie {i + 1}
                        </label>
                        {editable ? (
                          <input
                            id={idKg}
                            className={styles.entrada}
                            inputMode="decimal"
                            autoComplete="off"
                            value={serie.peso}
                            onChange={(ev) => cambiarSerie(it.beId, i, { peso: ev.target.value })}
                            onBlur={() => alSalirDeCampo(it, i)}
                          />
                        ) : (
                          <output id={idKg} className={styles.leido}>
                            {serie.peso || "—"}
                          </output>
                        )}
                      </td>
                      <td>
                        <label htmlFor={idReps} className="sr-only">
                          Repeticiones de la serie {i + 1}
                        </label>
                        {editable ? (
                          <input
                            id={idReps}
                            className={styles.entrada}
                            inputMode="numeric"
                            autoComplete="off"
                            value={serie.reps}
                            onChange={(ev) => cambiarSerie(it.beId, i, { reps: ev.target.value })}
                            onBlur={() => alSalirDeCampo(it, i)}
                          />
                        ) : (
                          <output id={idReps} className={styles.leido}>
                            {serie.reps || "—"}
                          </output>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`${styles.tilde} ${serie.hecha ? styles.tildeHecho : ""}`}
                          aria-pressed={serie.hecha}
                          aria-label={`Serie ${i + 1} ${serie.hecha ? "hecha, tocá para desmarcar" : "sin hacer, tocá para marcar como hecha"}`}
                          disabled={!editable || guardando === `${it.beId}:${i}`}
                          onClick={() => tildar(it, i)}
                        >
                          <span aria-hidden="true">{serie.hecha ? "✓" : ""}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {error?.beId === it.beId && <Mensaje tipo="error">{error.texto}</Mensaje>}
          </div>
        )}
      </li>
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
        <progress className={styles.barraAvance} value={cantidadHechos} max={items.length} aria-label="Avance del entrenamiento" />
        {!editable && <p className={styles.lectura}>Entrenamiento ya cerrado: esto es lo que registraste.</p>}
      </header>

      {error && !error.beId && <Mensaje tipo="error">{error.texto}</Mensaje>}

      {bloques.map((b) => (
        <section key={b.id} className={styles.bloque} aria-labelledby={`b-${b.id}`}>
          <div className={styles.bloqueCabecera}>
            <h2 id={`b-${b.id}`} className={styles.bloqueEtiqueta}>
              {b.nombre}
            </h2>
            {b.indicacion && <p className={styles.indicacion}>{b.indicacion}</p>}
          </div>
          <div className={styles.segmentos}>
            {segmentosDe(b.items).map((seg) =>
              seg.grupo ? (
                <div key={seg.grupo} className={styles.superSerie} style={colorDeGrupo(seg.grupo)}>
                  <p className={styles.superEtiqueta}>Super serie {seg.grupo} · hacelos seguidos</p>
                  <ul className={styles.lista}>
                    {seg.items.map((it, n) => renderFila(it, `${seg.grupo}${n + 1}`))}
                  </ul>
                </div>
              ) : (
                <ul key={seg.items[0]?.beId} className={styles.lista}>
                  {seg.items.map((it) => renderFila(it, null))}
                </ul>
              ),
            )}
          </div>
        </section>
      ))}

      <div className={styles.barra}>
        {editable ? (
          <Boton type="button" onClick={terminar} cargando={terminando}>
            Terminé
          </Boton>
        ) : (
          <Boton href="/plan">Volver a Mi plan</Boton>
        )}
      </div>
    </main>
  );
}
