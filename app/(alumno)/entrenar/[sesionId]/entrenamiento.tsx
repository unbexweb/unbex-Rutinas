"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { Boton } from "@/components/ui/Boton";
import { Mensaje } from "@/components/ui/Mensaje";
import type { EjercicioVista, EntrenamientoVista, ItemVista, SerieVista } from "@/lib/alumno/entrenar-tipos";
import { guardarRonda, guardarSerie, marcarEjercicio, terminarEntrenamiento } from "./actions";
import styles from "./entrenamiento.module.css";

const YOUTUBE_ID = /^[\w-]{11}$/;
const ERROR_RED = "No pudimos guardar. Revisá tu conexión y probá de nuevo.";

type EstadoGuardado = { estado: "guardando" | "guardado" | "error"; mensaje?: string };

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
  const [terminando, empezar] = useTransition();
  const [restaurado, setRestaurado] = useState(false);

  // ---- guardado de pesos y reps -------------------------------------------------------------
  // Lo escrito se guarda en la base al salir de cada campo (y 700 ms después de dejar de escribir), se tilde o no:
  // el tilde solo marca la serie o la ronda como hecha. Cada serie tiene su estado visible (Guardando / Guardado /
  // "No se guardó, tocá para reintentar"). Las refs dejan que las funciones asincrónicas vean siempre lo último.
  const [estados, setEstados] = useState<Record<string, EstadoGuardado>>({});
  const estadosRef = useRef(estados);
  const valoresRef = useRef(valores);
  valoresRef.current = valores;
  const elegidosRef = useRef(elegidos);
  elegidosRef.current = elegidos;
  // Lo último que se sabe guardado de cada serie ([peso, reps]), para no guardar de más.
  const guardadoValores = useRef<Record<string, string>>(
    Object.fromEntries(
      items.flatMap((it) => it.guardado.series.map((s, i) => [`${it.beId}:${i}`, JSON.stringify([s.peso, s.reps])] as const)),
    ),
  );
  const hechaPendiente = useRef<Record<string, boolean>>({}); // el tilde de una serie cambió y falta guardarlo
  const rondaPendiente = useRef<Record<string, boolean>>({}); // lo mismo, por ronda de una super serie
  const temporizadores = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const ocultarGuardado = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const enCurso = useRef<Record<string, Promise<boolean>>>({});
  const volverAGuardar = useRef<Record<string, boolean>>({}); // hubo cambios mientras se guardaba

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
        // El borrador cubre lo que no llegó a la base (sin señal, o cerró la app antes de que se guardara):
        // se recupera y se vuelve a guardar solo.
        const recuperar: [ItemVista, number][] = [];
        const mezclado: Record<string, SerieVista[]> = Object.fromEntries(
          Object.entries(valoresRef.current).map(([beId, series]) => [
            beId,
            series.map((s, i) => {
              const d = b.v?.[beId]?.[i];
              if (!d || (d.peso === s.peso && d.reps === s.reps) || (!d.peso && !d.reps)) return s;
              const it = items.find((x) => x.beId === beId);
              if (it?.registraCarga) recuperar.push([it, i]);
              return { ...s, peso: d.peso, reps: d.reps };
            }),
          ]),
        );
        valoresRef.current = mezclado;
        setValores(mezclado);
        const elegidosMezclados = Object.fromEntries(
          Object.entries(elegidosRef.current).map(([beId, id]) => {
            const it = items.find((x) => x.beId === beId);
            const elegido = b.e?.[beId];
            const valido = elegido === it?.ejercicio.id || elegido === it?.alternativa?.id;
            return [beId, valido && elegido && !it?.guardado.series.some((s) => s.hecha) ? elegido : id];
          }),
        );
        elegidosRef.current = elegidosMezclados;
        setElegidos(elegidosMezclados);
        if (recuperar.length) setTimeout(() => recuperar.forEach(([it, i]) => void guardarClave(it, i)), 300);
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

  useEffect(() => {
    if (!editable) return;
    const alOcultar = () => {
      if (document.visibilityState === "hidden") void guardarTodo();
    };
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("pagehide", alOcultar);
    return () => {
      document.removeEventListener("visibilitychange", alOcultar);
      window.removeEventListener("pagehide", alOcultar);
    };
    // se registra una vez: guardarTodo lee todo de refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);

  const hechoDe = (it: ItemVista) =>
    it.registraCarga || enSuper.has(it.beId)
      ? ((valores[it.beId] ?? []).length > 0 && (valores[it.beId] ?? []).every((s) => s.hecha)) || Boolean(heredados[it.beId])
      : Boolean(marcados[it.beId]);
  const cantidadHechos = items.filter(hechoDe).length;

  // Cambia una serie y actualiza la ref EN EL MOMENTO (las funciones asincrónicas leen de la ref, no del render).
  function cambiarSerie(beId: string, i: number, cambios: Partial<SerieVista>) {
    const nuevo = {
      ...valoresRef.current,
      [beId]: (valoresRef.current[beId] ?? []).map((s, j) => (j === i ? { ...s, ...cambios } : s)),
    };
    valoresRef.current = nuevo;
    setValores(nuevo);
  }

  function ponerEstado(clave: string, e: EstadoGuardado | null) {
    clearTimeout(ocultarGuardado.current[clave]);
    const siguiente = { ...estadosRef.current };
    if (e) siguiente[clave] = e;
    else delete siguiente[clave];
    estadosRef.current = siguiente;
    setEstados(siguiente);
    // "Guardado" es un aviso discreto: se va solo a los pocos segundos. Los errores se quedan hasta que se resuelvan.
    if (e?.estado === "guardado") {
      ocultarGuardado.current[clave] = setTimeout(() => {
        if (estadosRef.current[clave]?.estado === "guardado") ponerEstado(clave, null);
      }, 3500);
    }
  }

  // Guarda los valores de una serie (y su tilde, si cambió). Si ya hay un guardado en curso de esa serie, no se pierde
  // nada: queda marcado para repetirse con lo último apenas termine el actual.
  function guardarClave(it: ItemVista, i: number): Promise<boolean> {
    const clave = `${it.beId}:${i}`;
    clearTimeout(temporizadores.current[clave]);
    const actual = enCurso.current[clave];
    if (actual) {
      volverAGuardar.current[clave] = true;
      return actual;
    }
    const tarea = (async () => {
      let ok = true;
      do {
        volverAGuardar.current[clave] = false;
        const s = valoresRef.current[it.beId]?.[i];
        if (!s) break;
        const conTilde = hechaPendiente.current[clave] === true;
        const valoresAhora = JSON.stringify([s.peso, s.reps]);
        ponerEstado(clave, { estado: "guardando" });
        const res = await guardarSerie({
          asignacionId: vista.asignacionId,
          sesionId: vista.sesionId,
          beId: it.beId,
          ejercicioUsadoId: elegidosRef.current[it.beId] ?? it.ejercicio.id,
          nSerie: i + 1,
          totalSeries: valoresRef.current[it.beId]?.length ?? it.nSeries,
          peso: s.peso,
          reps: s.reps,
          hecha: conTilde ? s.hecha : undefined,
        }).catch(() => ({ ok: false as const, error: ERROR_RED }));
        if (res.ok) {
          guardadoValores.current[clave] = valoresAhora;
          if (conTilde && valoresRef.current[it.beId]?.[i]?.hecha === s.hecha) delete hechaPendiente.current[clave];
          ponerEstado(clave, { estado: "guardado" });
        } else {
          ok = false;
          ponerEstado(clave, { estado: "error", mensaje: res.error });
          break;
        }
      } while (volverAGuardar.current[clave]);
      return ok;
    })().finally(() => {
      delete enCurso.current[clave];
    });
    enCurso.current[clave] = tarea;
    return tarea;
  }

  // Mientras escribe: se guarda 700 ms después de la última tecla.
  function programarGuardado(it: ItemVista, i: number) {
    const clave = `${it.beId}:${i}`;
    clearTimeout(temporizadores.current[clave]);
    temporizadores.current[clave] = setTimeout(() => void guardarClave(it, i), 700);
  }

  function cambiarValor(it: ItemVista, i: number, cambios: Partial<SerieVista>) {
    cambiarSerie(it.beId, i, cambios);
    programarGuardado(it, i);
  }

  // Al salir del campo se guarda enseguida (si hay algo sin guardar o la última vez falló).
  function alSalirDeCampo(it: ItemVista, i: number) {
    const clave = `${it.beId}:${i}`;
    const s = valoresRef.current[it.beId]?.[i];
    if (!s) return;
    const sinGuardar = JSON.stringify([s.peso, s.reps]) !== guardadoValores.current[clave];
    if (sinGuardar || estadosRef.current[clave]?.estado === "error") void guardarClave(it, i);
  }

  // ---- ejercicios sueltos con carga: el tilde solo marca la serie como hecha (los valores ya se guardan solos)
  function tildar(it: ItemVista, i: number) {
    const actual = valoresRef.current[it.beId]?.[i];
    if (!actual) return;
    setError(null);
    cambiarSerie(it.beId, i, { hecha: !actual.hecha });
    setHeredados((h) => ({ ...h, [it.beId]: false }));
    hechaPendiente.current[`${it.beId}:${i}`] = true;
    void guardarClave(it, i);
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

  // Guarda el tilde de la ronda con lo que haya escrito. Si falla, el tilde queda marcado y se ve el error al lado
  // de la ronda; "tocá para reintentar" vuelve a mandarlo.
  function guardarRondaDe(seg: SuperSerie, ronda: number): Promise<boolean> {
    const claveRonda = `${seg.clave}:${ronda}`;
    const actual = enCurso.current[claveRonda];
    if (actual) {
      volverAGuardar.current[claveRonda] = true;
      return actual;
    }
    const tarea = (async () => {
      let ok = true;
      do {
        volverAGuardar.current[claveRonda] = false;
        const p = seg.items.filter((it) => (valoresRef.current[it.beId]?.length ?? 0) >= ronda);
        // Primero terminan los guardados de valores en curso de esa ronda: uno viejo no puede pisar al nuevo.
        await Promise.all(p.map((it) => enCurso.current[`${it.beId}:${ronda - 1}`]).filter(Boolean));
        const hecha = rondaPendiente.current[claveRonda];
        ponerEstado(claveRonda, { estado: "guardando" });
        const res = await guardarRonda({
          asignacionId: vista.asignacionId,
          sesionId: vista.sesionId,
          ronda,
          hecha: hecha ?? p.every((it) => valoresRef.current[it.beId]?.[ronda - 1]?.hecha),
          filas: p.map((it) => {
            const s = valoresRef.current[it.beId]?.[ronda - 1] ?? { peso: "", reps: "", hecha: false };
            return {
              beId: it.beId,
              ejercicioUsadoId: elegidosRef.current[it.beId] ?? it.ejercicio.id,
              totalSeries: valoresRef.current[it.beId]?.length ?? ronda,
              // los ejercicios sin carga no tienen campos: se guarda la ronda sin peso ni reps
              peso: it.registraCarga ? s.peso : "",
              reps: it.registraCarga ? s.reps : "",
            };
          }),
        }).catch(() => ({ ok: false as const, error: ERROR_RED }));
        if (res.ok) {
          for (const it of p) {
            const s = valoresRef.current[it.beId]?.[ronda - 1];
            if (s) guardadoValores.current[`${it.beId}:${ronda - 1}`] = JSON.stringify([s.peso, s.reps]);
          }
          const ahora = p.every((it) => valoresRef.current[it.beId]?.[ronda - 1]?.hecha);
          if (hecha === undefined || hecha === ahora) delete rondaPendiente.current[claveRonda];
          ponerEstado(claveRonda, { estado: "guardado" });
        } else {
          ok = false;
          ponerEstado(claveRonda, { estado: "error", mensaje: res.error });
          break;
        }
      } while (volverAGuardar.current[claveRonda]);
      return ok;
    })().finally(() => {
      delete enCurso.current[claveRonda];
    });
    enCurso.current[claveRonda] = tarea;
    return tarea;
  }

  function tildarRonda(seg: SuperSerie, ronda: number) {
    setError(null);
    const p = participan(seg, ronda);
    const nueva = !rondaHecha(seg, ronda);
    for (const it of p) {
      clearTimeout(temporizadores.current[`${it.beId}:${ronda - 1}`]);
      cambiarSerie(it.beId, ronda - 1, { hecha: nueva });
      setHeredados((h) => ({ ...h, [it.beId]: false }));
    }
    rondaPendiente.current[`${seg.clave}:${ronda}`] = nueva;
    void guardarRondaDe(seg, ronda);
  }

  // Estado visible de una serie o de una ronda (de la ronda y de las series que la forman).
  function reintentarRonda(seg: SuperSerie, ronda: number) {
    if (estadosRef.current[`${seg.clave}:${ronda}`]?.estado === "error") void guardarRondaDe(seg, ronda);
    for (const it of participan(seg, ronda)) {
      if (estadosRef.current[`${it.beId}:${ronda - 1}`]?.estado === "error") void guardarClave(it, ronda - 1);
    }
  }

  // Termina TODO lo pendiente antes de cerrar el entrenamiento. Devuelve false si algo no se pudo guardar.
  async function guardarTodo(): Promise<boolean> {
    for (const t of Object.values(temporizadores.current)) clearTimeout(t);
    const tareas: Promise<boolean>[] = [];
    for (const it of items) {
      if (!it.registraCarga) continue;
      (valoresRef.current[it.beId] ?? []).forEach((s, i) => {
        const clave = `${it.beId}:${i}`;
        const sinGuardar = JSON.stringify([s.peso, s.reps]) !== guardadoValores.current[clave];
        if (sinGuardar || hechaPendiente.current[clave] || estadosRef.current[clave]?.estado === "error") {
          tareas.push(guardarClave(it, i));
        }
      });
    }
    for (const b of bloquesVista) {
      for (const seg of b.segmentos) {
        if (seg.tipo !== "super") continue;
        for (let r = 1; r <= seg.rondas; r++) {
          const k = `${seg.clave}:${r}`;
          if (rondaPendiente.current[k] !== undefined || estadosRef.current[k]?.estado === "error") {
            tareas.push(guardarRondaDe(seg, r));
          }
        }
      }
    }
    await Promise.all([...tareas, ...Object.values(enCurso.current)]);
    return !Object.values(estadosRef.current).some((e) => e.estado === "error");
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
      // Nada se pierde: antes de cerrar se termina de guardar todo lo pendiente.
      if (!(await guardarTodo())) {
        setError({
          clave: null,
          texto: "Hay series que no se guardaron. Tocá \"No se guardó, tocá para reintentar\" al lado de cada una y probá de nuevo.",
        });
        return;
      }
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
                    <Fragment key={i}>
                    <tr className={serie.hecha ? styles.serieHecha : undefined}>
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
                            onChange={(ev) => cambiarValor(it, i, { peso: ev.target.value })}
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
                            onChange={(ev) => cambiarValor(it, i, { reps: ev.target.value })}
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
                          disabled={!editable}
                          onClick={() => tildar(it, i)}
                        >
                          <span aria-hidden="true">{serie.hecha ? "✓" : ""}</span>
                        </button>
                      </td>
                    </tr>
                    {estados[`${it.beId}:${i}`] && (
                      <tr className={styles.estadoFila}>
                        <td colSpan={5}>{renderEstado([`${it.beId}:${i}`], () => void guardarClave(it, i))}</td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </li>
    );
  }

  // Indicador discreto por serie o ronda: Guardando… / Guardado / error con botón para reintentar.
  function renderEstado(claves: string[], reintentar: () => void) {
    const lista = claves.map((c) => estados[c]).filter((e): e is EstadoGuardado => Boolean(e));
    const fallo = lista.find((e) => e.estado === "error");
    if (fallo) {
      return (
        <span className={styles.errorGuardado}>
          <button type="button" className={styles.reintentar} onClick={reintentar}>
            No se guardó, tocá para reintentar
          </button>
          {fallo.mensaje && fallo.mensaje !== ERROR_RED && <span className={styles.detalleError}>{fallo.mensaje}</span>}
        </span>
      );
    }
    if (lista.some((e) => e.estado === "guardando")) {
      return (
        <span role="status" className={styles.estadoGuardado}>
          Guardando…
        </span>
      );
    }
    if (lista.some((e) => e.estado === "guardado")) {
      return (
        <span role="status" className={styles.estadoGuardado}>
          Guardado <span aria-hidden="true">✓</span>
        </span>
      );
    }
    return null;
  }

  // "Anterior": lo de la última vez en esa serie; al tocarlo copia peso y reps a los campos.
  function renderAnterior(it: ItemVista, i: number, previa: { peso: string; reps: string } | undefined) {
    if (editable && previa && (previa.peso || previa.reps)) {
      return (
        <button
          type="button"
          className={styles.anterior}
          aria-label={`Copiar lo de la última vez: ${previa.peso || "sin peso"} kilos, ${previa.reps || "sin"} repeticiones`}
          onClick={() => {
            cambiarSerie(it.beId, i, { peso: previa.peso, reps: previa.reps });
            void guardarClave(it, i);
          }}
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
                        {renderEstado(
                          [`${seg.clave}:${ronda}`, ...participan(seg, ronda).map((it) => `${it.beId}:${ronda - 1}`)],
                          () => reintentarRonda(seg, ronda),
                        )}
                      </th>
                      <td>
                        <button
                          type="button"
                          className={`${styles.tilde} ${hechaRonda ? styles.tildeHecho : ""}`}
                          aria-pressed={hechaRonda}
                          aria-label={`Ronda ${ronda} ${hechaRonda ? "hecha, tocá para desmarcar" : "sin hacer, tocá para marcar como hecha"}`}
                          disabled={!editable}
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
                                    onChange={(ev) => cambiarValor(it, ronda - 1, { peso: ev.target.value })}
                                    onBlur={() => alSalirDeCampo(it, ronda - 1)}
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
                                    onChange={(ev) => cambiarValor(it, ronda - 1, { reps: ev.target.value })}
                                    onBlur={() => alSalirDeCampo(it, ronda - 1)}
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
