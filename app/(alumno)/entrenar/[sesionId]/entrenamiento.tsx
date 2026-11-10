"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { Boton } from "@/components/ui/Boton";
import { Mensaje } from "@/components/ui/Mensaje";
import type { EjercicioVista, EntrenamientoVista, ItemVista, SerieVista } from "@/lib/alumno/entrenar-tipos";
import { guardarRonda, guardarSerie, marcarEjercicio, terminarEntrenamiento } from "./actions";
import styles from "./entrenamiento.module.css";

const YOUTUBE_ID = /^[\w-]{11}$/;
const ERROR_RED = "No pudimos guardar. Revisá tu conexión y probá de nuevo.";

// Las letras de las super series se asignan en orden en toda la sesión (solo de visualización: el campo
// grupo de la base no cambia). Los colores rotan entre 4 de la familia de la marca.
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const COLORES = ["--color-ss-violeta", "--color-ss-frambuesa", "--color-ss-ciruela", "--color-ss-terracota"];

function Video({ ejercicio, etiqueta = "Ver video" }: { ejercicio: EjercicioVista; etiqueta?: string }) {
  const [visible, setVisible] = useState(false);
  const embebible = ejercicio.youtubeId && YOUTUBE_ID.test(ejercicio.youtubeId);
  if (!embebible && !ejercicio.videoUrl) return null;

  if (!embebible) {
    return (
      <a className={styles.verVideo} href={ejercicio.videoUrl!} target="_blank" rel="noopener noreferrer">
        {etiqueta}
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
      {etiqueta}
    </button>
  );
}

// "3 × 6/8", tal cual lo cargó el profe.
function seriesPorReps(it: ItemVista): string {
  if (it.series && it.reps) return `${it.series} × ${it.reps}`;
  if (it.series) return `${it.series} series`;
  return it.reps ? `${it.reps} reps` : "";
}

type Segmento =
  | { tipo: "solo"; item: ItemVista }
  | { tipo: "super"; clave: string; letra: string; estilo: CSSProperties; items: ItemVista[]; rondas: number };

// Dentro de cada bloque, 2 o más ejercicios con el mismo grupo forman UNA super serie (se agrupa donde aparece el primero).
function segmentosDeBloque(items: ItemVista[], bloqueId: string, asignarLetra: () => number): Segmento[] {
  const vistos = new Set<string>();
  const out: Segmento[] = [];
  for (const it of items) {
    const mismos = it.grupo ? items.filter((x) => x.grupo === it.grupo) : [];
    if (!it.grupo || mismos.length < 2) {
      out.push({ tipo: "solo", item: it });
    } else if (!vistos.has(it.grupo)) {
      vistos.add(it.grupo);
      const n = asignarLetra();
      out.push({
        tipo: "super",
        clave: `ss:${bloqueId}:${it.grupo}`,
        letra: LETRAS[n] ?? "?",
        estilo: { "--color-grupo": `var(${COLORES[n % COLORES.length]})` } as CSSProperties,
        items: mismos,
        rondas: Math.max(...mismos.map((x) => x.nSeries)),
      });
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
  // Ejercicios sueltos sin carga: un toque los marca.
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
  const [error, setError] = useState<{ clave: string | null; texto: string } | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null); // "beId:indice" o "clave:ronda"
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

  // ---- bloques y segmentos (ejercicios sueltos / super series)
  const bloques = items.reduce<{ id: string; nombre: string; indicacion: string | null; items: ItemVista[] }[]>(
    (acc, it) => {
      const ultimo = acc[acc.length - 1];
      if (ultimo?.id === it.bloqueId) ultimo.items.push(it);
      else acc.push({ id: it.bloqueId, nombre: it.bloqueNombre, indicacion: it.bloqueIndicacion, items: [it] });
      return acc;
    },
    [],
  );
  let letrasUsadas = 0;
  const bloquesVista = bloques.map((b) => ({
    ...b,
    segmentos: segmentosDeBloque(b.items, b.id, () => letrasUsadas++),
  }));
  const enSuper = new Set(
    bloquesVista.flatMap((b) => b.segmentos.flatMap((s) => (s.tipo === "super" ? s.items.map((i) => i.beId) : []))),
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
    it.registraCarga || enSuper.has(it.beId)
      ? ((valores[it.beId] ?? []).length > 0 && (valores[it.beId] ?? []).every((s) => s.hecha)) || Boolean(heredados[it.beId])
      : Boolean(marcados[it.beId]);
  const cantidadHechos = items.filter(hechoDe).length;

  function cambiarSerie(beId: string, i: number, cambios: Partial<SerieVista>) {
    setValores((v) => ({ ...v, [beId]: (v[beId] ?? []).map((s, j) => (j === i ? { ...s, ...cambios } : s)) }));
  }

  // ---- ejercicios sueltos con carga: un tilde por serie
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
    else setError({ clave: it.beId, texto: res.error });
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

  // ---- super series: un tilde por ronda guarda todos los ejercicios de esa ronda
  type SuperSerie = Extract<Segmento, { tipo: "super" }>;
  const participan = (seg: SuperSerie, ronda: number) =>
    seg.items.filter((it) => (valores[it.beId]?.length ?? 0) >= ronda);
  const rondaHecha = (seg: SuperSerie, ronda: number) => {
    const p = participan(seg, ronda);
    return p.length > 0 && p.every((it) => valores[it.beId]?.[ronda - 1]?.hecha);
  };
  const rondasHechas = (seg: SuperSerie) =>
    Array.from({ length: seg.rondas }, (_, i) => i + 1).filter((r) => rondaHecha(seg, r)).length;

  async function guardarRondaDe(seg: SuperSerie, ronda: number, hecha: boolean): Promise<boolean> {
    const p = participan(seg, ronda);
    const clave = `${seg.clave}:${ronda}`;
    setGuardando(clave);
    const res = await guardarRonda({
      asignacionId: vista.asignacionId,
      sesionId: vista.sesionId,
      ronda,
      hecha,
      filas: p.map((it) => {
        const s = valores[it.beId]?.[ronda - 1] ?? { peso: "", reps: "", hecha };
        return {
          beId: it.beId,
          ejercicioUsadoId: elegidos[it.beId] ?? it.ejercicio.id,
          totalSeries: valores[it.beId]?.length ?? ronda,
          // los ejercicios sin carga no tienen campos: se guarda la ronda sin peso ni reps
          peso: it.registraCarga ? s.peso : "",
          reps: it.registraCarga ? s.reps : "",
        };
      }),
    }).catch(() => ({ ok: false as const, error: ERROR_RED }));
    setGuardando(null);
    if (res.ok) {
      for (const it of p) {
        const s = valores[it.beId]?.[ronda - 1];
        if (s) guardado.current[`${it.beId}:${ronda - 1}`] = JSON.stringify([s.peso, s.reps, hecha]);
      }
    } else setError({ clave: seg.clave, texto: res.error });
    return res.ok;
  }

  async function tildarRonda(seg: SuperSerie, ronda: number) {
    if (guardando) return;
    setError(null);
    const p = participan(seg, ronda);
    const nueva = !rondaHecha(seg, ronda);
    const previas = p.map((it) => [it.beId, Boolean(valores[it.beId]?.[ronda - 1]?.hecha)] as const);
    for (const it of p) {
      cambiarSerie(it.beId, ronda - 1, { hecha: nueva });
      setHeredados((h) => ({ ...h, [it.beId]: false }));
    }
    // Se guarda con lo que hay escrito en este momento; si falla, vuelve a como estaba.
    const ok = await guardarRondaDe(seg, ronda, nueva);
    if (!ok) for (const [beId, antes] of previas) cambiarSerie(beId, ronda - 1, { hecha: antes });
  }

  function alSalirDeRonda(seg: SuperSerie, ronda: number) {
    if (guardando || !rondaHecha(seg, ronda)) return;
    const cambio = participan(seg, ronda).some((it) => {
      const s = valores[it.beId]?.[ronda - 1];
      return s && guardado.current[`${it.beId}:${ronda - 1}`] !== JSON.stringify([s.peso, s.reps, s.hecha]);
    });
    if (cambio) void guardarRondaDe(seg, ronda, true);
  }

  // ---- sueltos sin carga y abrir/cerrar
  function tocarSuelto(it: ItemVista) {
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
        setError({ clave: null, texto: res.error });
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
      } else setError({ clave: null, texto: res.error });
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

  const usadoDe = (it: ItemVista) => {
    const usadoId = elegidos[it.beId] ?? it.ejercicio.id;
    return it.alternativa && it.alternativa.id === usadoId ? it.alternativa : it.ejercicio;
  };

  function chips(it: ItemVista) {
    const sxr = seriesPorReps(it);
    return sxr || it.cargaSugerida ? (
      <span className={styles.chips}>
        {sxr && <span className={styles.chip}>{sxr}</span>}
        {it.cargaSugerida && <span className={styles.chip}>{it.cargaSugerida}</span>}
      </span>
    ) : null;
  }

  // Las funciones render* son funciones comunes (no componentes): si fueran componentes definidos acá adentro,
  // se recrearían en cada tecla y los campos perderían el foco.
  function renderAlternativas(it: ItemVista, etiqueta: string) {
    if (!it.alternativa) return null;
    const usadoId = elegidos[it.beId] ?? it.ejercicio.id;
    return (
      <fieldset key={`alt-${it.beId}`} className={styles.alternativas} disabled={!editable}>
        <legend>{etiqueta}</legend>
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
    );
  }

  function renderSuelto(it: ItemVista) {
    const usado = usadoDe(it);
    const usadoId = usado.id;
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
          <span className={styles.nombre}>{usado.nombre}</span>
          {chips(it)}
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
      <li key={it.beId} className={styles.item}>
        {interactiva ? (
          <button
            type="button"
            className={`${styles.fila} ${hecho ? styles.filaHecha : ""}`}
            onClick={() => tocarSuelto(it)}
            aria-expanded={it.registraCarga ? abiertoAca : undefined}
            aria-pressed={it.registraCarga ? undefined : hecho}
            aria-label={`${usado.nombre}${sxr ? `, ${sxr}` : ""}${it.cargaSugerida ? `, ${it.cargaSugerida}` : ""}, ${estado}`}
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
            {renderAlternativas(it, "¿Cuál hiciste?")}
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
                      <td>{renderAnterior(it, i, previa)}</td>
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

            {error?.clave === it.beId && <Mensaje tipo="error">{error.texto}</Mensaje>}
          </div>
        )}
      </li>
    );
  }

  // "Anterior": lo de la última vez en esa serie; al tocarlo copia peso y reps a los campos.
  function renderAnterior(it: ItemVista, i: number, previa: { peso: string; reps: string } | undefined) {
    if (editable && previa && (previa.peso || previa.reps)) {
      return (
        <button
          type="button"
          className={styles.anterior}
          aria-label={`Copiar lo de la última vez: ${previa.peso || "sin peso"} kilos, ${previa.reps || "sin"} repeticiones`}
          onClick={() => cambiarSerie(it.beId, i, { peso: previa.peso, reps: previa.reps })}
        >
          {previa.peso || "—"} × {previa.reps || "—"}
        </button>
      );
    }
    return <span className={styles.sinDato}>—</span>;
  }

  function renderSuper(seg: SuperSerie) {
    const abiertoAca = abierto === seg.clave;
    const hechas = rondasHechas(seg);
    const hecha = hechas === seg.rondas;
    const nombres = seg.items.map((it, n) => `${seg.letra}${n + 1} ${usadoDe(it).nombre}`).join(", ");

    return (
      <li key={seg.clave} className={styles.superCard} style={seg.estilo}>
        <button
          type="button"
          className={`${styles.superCabecera} ${hecha ? styles.filaHecha : ""}`}
          onClick={() => {
            setError(null);
            setAbierto(abiertoAca ? null : seg.clave);
          }}
          aria-expanded={abiertoAca}
          aria-label={`Super serie ${seg.letra}: ${nombres}. ${hechas} de ${seg.rondas} rondas, ${hecha ? "hecha" : "sin hacer"}`}
        >
          <span className={`${styles.check} ${hecha ? styles.checkHecho : ""}`} aria-hidden="true">
            {hecha ? "✓" : ""}
          </span>
          <span className={styles.textoFila}>
            <span className={styles.superEtiqueta}>Super serie {seg.letra} · hacelos seguidos</span>
            {seg.items.map((it, n) => (
              <span key={it.beId} className={styles.superEjercicio}>
                <span className={styles.nombre}>
                  <span className={styles.numero}>
                    {seg.letra}
                    {n + 1}
                  </span>
                  {usadoDe(it).nombre}
                </span>
                {chips(it)}
              </span>
            ))}
            <span className={styles.rondas}>
              {hechas} de {seg.rondas} {seg.rondas === 1 ? "ronda" : "rondas"}
            </span>
          </span>
          <span className={styles.flecha} aria-hidden="true">
            {abiertoAca ? "▴" : "▾"}
          </span>
        </button>

        {abiertoAca && (
          <div className={styles.panel}>
            {seg.items.map((it, n) => it.nota && <p key={`nota-${it.beId}`} className={styles.nota}><strong>{seg.letra}{n + 1}:</strong> {it.nota}</p>)}
            {seg.items.map((it, n) => renderAlternativas(it, `¿Cuál hiciste en ${seg.letra}${n + 1}?`))}

            <div className={styles.videos}>
              {seg.items.map((it, n) => (
                <Video
                  key={`${it.beId}-${usadoDe(it).id}`}
                  ejercicio={usadoDe(it)}
                  etiqueta={`Ver video: ${seg.letra}${n + 1} ${usadoDe(it).nombre}`}
                />
              ))}
            </div>

            <table className={styles.tabla}>
              <caption className="sr-only">Rondas de la super serie {seg.letra}</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span aria-hidden="true">Ej.</span>
                    <span className="sr-only">Ejercicio</span>
                  </th>
                  <th scope="col">Anterior</th>
                  <th scope="col">Kg</th>
                  <th scope="col">Reps</th>
                  <th scope="col">
                    <span aria-hidden="true">✓</span>
                    <span className="sr-only">Ronda hecha</span>
                  </th>
                </tr>
              </thead>
              {Array.from({ length: seg.rondas }, (_, i) => i + 1).map((ronda) => {
                const hechaRonda = rondaHecha(seg, ronda);
                return (
                  <tbody key={ronda} className={hechaRonda ? styles.serieHecha : undefined}>
                    <tr className={styles.rondaCab}>
                      <th scope="colgroup" colSpan={4}>
                        Ronda {ronda}
                      </th>
                      <td>
                        <button
                          type="button"
                          className={`${styles.tilde} ${hechaRonda ? styles.tildeHecho : ""}`}
                          aria-pressed={hechaRonda}
                          aria-label={`Ronda ${ronda} ${hechaRonda ? "hecha, tocá para desmarcar" : "sin hacer, tocá para marcar como hecha"}`}
                          disabled={!editable || guardando === `${seg.clave}:${ronda}`}
                          onClick={() => tildarRonda(seg, ronda)}
                        >
                          <span aria-hidden="true">{hechaRonda ? "✓" : ""}</span>
                        </button>
                      </td>
                    </tr>
                    {seg.items.map((it, n) => {
                      const serie = valores[it.beId]?.[ronda - 1];
                      if (!serie) return null; // este ejercicio tiene menos series que rondas
                      const idKg = `${it.beId}-kg-${ronda}`;
                      const idReps = `${it.beId}-reps-${ronda}`;
                      const previa = it.anterior[usadoDe(it).id]?.[ronda - 1];
                      return (
                        <tr key={it.beId}>
                          <th scope="row" className={styles.serieN}>
                            <span className={styles.numero}>
                              {seg.letra}
                              {n + 1}
                            </span>
                          </th>
                          <td>{it.registraCarga ? renderAnterior(it, ronda - 1, previa) : <span className={styles.sinDato}>—</span>}</td>
                          {it.registraCarga ? (
                            <>
                              <td>
                                <label htmlFor={idKg} className="sr-only">
                                  Kilos de {seg.letra}
                                  {n + 1}, ronda {ronda}
                                </label>
                                {editable ? (
                                  <input
                                    id={idKg}
                                    className={styles.entrada}
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={serie.peso}
                                    onChange={(ev) => cambiarSerie(it.beId, ronda - 1, { peso: ev.target.value })}
                                    onBlur={() => alSalirDeRonda(seg, ronda)}
                                  />
                                ) : (
                                  <output id={idKg} className={styles.leido}>
                                    {serie.peso || "—"}
                                  </output>
                                )}
                              </td>
                              <td>
                                <label htmlFor={idReps} className="sr-only">
                                  Repeticiones de {seg.letra}
                                  {n + 1}, ronda {ronda}
                                </label>
                                {editable ? (
                                  <input
                                    id={idReps}
                                    className={styles.entrada}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={serie.reps}
                                    onChange={(ev) => cambiarSerie(it.beId, ronda - 1, { reps: ev.target.value })}
                                    onBlur={() => alSalirDeRonda(seg, ronda)}
                                  />
                                ) : (
                                  <output id={idReps} className={styles.leido}>
                                    {serie.reps || "—"}
                                  </output>
                                )}
                              </td>
                            </>
                          ) : (
                            // Sin carga: solo las reps que indicó el profe (o nada)
                            <>
                              <td className={styles.sinDato}>—</td>
                              <td className={styles.leido}>{it.reps ?? "—"}</td>
                            </>
                          )}
                          <td />
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>

            {error?.clave === seg.clave && <Mensaje tipo="error">{error.texto}</Mensaje>}
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

      {error && !error.clave && <Mensaje tipo="error">{error.texto}</Mensaje>}

      {bloquesVista.map((b) => (
        <section key={b.id} className={styles.bloque} aria-labelledby={`b-${b.id}`}>
          <div className={styles.bloqueCabecera}>
            <h2 id={`b-${b.id}`} className={styles.bloqueEtiqueta}>
              {b.nombre}
            </h2>
            {b.indicacion && <p className={styles.indicacion}>{b.indicacion}</p>}
          </div>
          <ul className={styles.lista}>
            {b.segmentos.map((seg) => (seg.tipo === "super" ? renderSuper(seg) : renderSuelto(seg.item)))}
          </ul>
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
