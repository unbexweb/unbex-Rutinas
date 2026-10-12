"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import type {
  BloqueEditor,
  CambiosEjercicio,
  EjercicioBiblioteca,
  EjercicioDeBloque,
  Resultado,
  SesionEditor,
} from "@/lib/staff/editor-tipos";
import e from "@/components/staff/estilos.module.css";
import s from "./editor.module.css";
import {
  actualizarBloque,
  actualizarEjercicio,
  actualizarPlan,
  agregarBloque,
  agregarEjercicio,
  copiarSemana,
  eliminarBloque,
  eliminarEjercicio,
  moverBloque,
  moverEjercicio,
} from "./actions";

type Estado = "ok" | "guardando" | "error";
type Guardar = <T>(fn: () => Promise<Resultado<T>>) => Promise<Resultado<T>>;

// ------------------------------------------------------------------ campo con guardado al salir
function CampoAuto({
  etiqueta,
  valor,
  onGuardar,
  multilinea,
  className,
}: {
  etiqueta: string;
  valor: string;
  onGuardar: (nuevo: string) => void;
  multilinea?: boolean;
  className?: string;
}) {
  const id = useId();
  const [texto, setTexto] = useState(valor);
  const [previo, setPrevio] = useState(valor);
  if (valor !== previo) {
    setPrevio(valor);
    setTexto(valor);
  }

  const alSalir = () => {
    if (texto !== valor) onGuardar(texto);
  };

  return (
    <div className={`${s.campo} ${className ?? ""}`}>
      <label htmlFor={id}>{etiqueta}</label>
      {multilinea ? (
        <textarea id={id} value={texto} rows={2} onChange={(ev) => setTexto(ev.target.value)} onBlur={alSalir} />
      ) : (
        <input id={id} value={texto} onChange={(ev) => setTexto(ev.target.value)} onBlur={alSalir} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ buscador de la biblioteca
function SelectorEjercicio({
  etiqueta,
  valor,
  biblioteca,
  onElegir,
  permitirVacio,
  abiertoInicial,
}: {
  etiqueta: string;
  valor: string | null;
  biblioteca: EjercicioBiblioteca[];
  onElegir: (id: string | null) => void;
  permitirVacio?: boolean;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial ?? false);
  const [q, setQ] = useState("");
  const actual = biblioteca.find((b) => b.id === valor);
  const termino = q.trim().toLowerCase();
  const resultados = biblioteca
    .filter((b) => b.activo && (!termino || b.nombre.toLowerCase().includes(termino)))
    .slice(0, 30);

  return (
    <div className={s.selector}>
      <span className={s.etiqueta}>{etiqueta}</span>
      <button type="button" className={s.selectorBoton} aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        {actual ? actual.nombre + (actual.activo ? "" : " (desactivado)") : permitirVacio ? "Sin alternativa" : "Elegir ejercicio"}
      </button>
      {abierto && (
        <div className={s.lista}>
          <input
            type="search"
            autoFocus
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder="Buscar en la biblioteca"
            aria-label={`Buscar ${etiqueta.toLowerCase()}`}
          />
          <ul>
            {permitirVacio && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onElegir(null);
                    setAbierto(false);
                    setQ("");
                  }}
                >
                  Sin alternativa
                </button>
              </li>
            )}
            {resultados.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => {
                    onElegir(b.id);
                    setAbierto(false);
                    setQ("");
                  }}
                >
                  {b.nombre}
                </button>
              </li>
            ))}
            {!resultados.length && <li className={e.ayuda}>No hay ejercicios con ese nombre.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function Flechas({
  onArriba,
  onAbajo,
  onQuitar,
  puedeArriba,
  puedeAbajo,
  que,
}: {
  onArriba: () => void;
  onAbajo: () => void;
  onQuitar: () => void;
  puedeArriba: boolean;
  puedeAbajo: boolean;
  que: string;
}) {
  return (
    <div className={s.flechas}>
      <button type="button" onClick={onArriba} disabled={!puedeArriba} aria-label={`Subir ${que}`}>
        ↑
      </button>
      <button type="button" onClick={onAbajo} disabled={!puedeAbajo} aria-label={`Bajar ${que}`}>
        ↓
      </button>
      <button type="button" onClick={onQuitar} className={s.quitar} aria-label={`Quitar ${que}`}>
        Quitar
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ un ejercicio dentro de un bloque
function FilaEjercicio({
  ej,
  idx,
  total,
  biblioteca,
  guardar,
  onCambio,
  onQuitar,
  onMover,
}: {
  ej: EjercicioDeBloque;
  idx: number;
  total: number;
  biblioteca: EjercicioBiblioteca[];
  guardar: Guardar;
  onCambio: (cambios: CambiosEjercicio) => void;
  onQuitar: () => void;
  onMover: (dir: "arriba" | "abajo") => void;
}) {
  const cambiar = (cambios: CambiosEjercicio) => {
    onCambio(cambios);
    void guardar(() => actualizarEjercicio(ej.id, cambios));
  };
  const nombre = biblioteca.find((b) => b.id === ej.ejercicio_id)?.nombre ?? "ejercicio";

  return (
    <div className={s.ejercicio}>
      <SelectorEjercicio
        etiqueta="Ejercicio"
        valor={ej.ejercicio_id}
        biblioteca={biblioteca}
        onElegir={(id) => id && cambiar({ ejercicio_id: id })}
      />
      <SelectorEjercicio
        etiqueta="Alternativa"
        valor={ej.alternativa_id}
        biblioteca={biblioteca}
        permitirVacio
        onElegir={(id) => cambiar({ alternativa_id: id })}
      />
      <div className={s.trio}>
        <CampoAuto etiqueta="Series" valor={ej.series ?? ""} onGuardar={(v) => cambiar({ series: v })} />
        <CampoAuto etiqueta="Reps" valor={ej.reps ?? ""} onGuardar={(v) => cambiar({ reps: v })} />
        <CampoAuto etiqueta="Carga" valor={ej.carga_sugerida ?? ""} onGuardar={(v) => cambiar({ carga_sugerida: v })} />
      </div>
      <label className={s.check}>
        <input
          type="checkbox"
          checked={ej.registra_carga}
          onChange={(ev) => cambiar({ registra_carga: ev.target.checked })}
        />
        Registra carga
      </label>
      <CampoAuto etiqueta="Nota" valor={ej.nota ?? ""} onGuardar={(v) => cambiar({ nota: v })} />
      <Flechas
        que={nombre}
        puedeArriba={idx > 0}
        puedeAbajo={idx < total - 1}
        onArriba={() => onMover("arriba")}
        onAbajo={() => onMover("abajo")}
        onQuitar={onQuitar}
      />
    </div>
  );
}

// ------------------------------------------------------------------ un bloque
function TarjetaBloque({
  bloque,
  idx,
  total,
  biblioteca,
  guardar,
  onCambio,
  onQuitar,
  onMover,
  setEjercicios,
}: {
  bloque: BloqueEditor;
  idx: number;
  total: number;
  biblioteca: EjercicioBiblioteca[];
  guardar: Guardar;
  onCambio: (cambios: { nombre?: string; indicacion?: string | null }) => void;
  onQuitar: () => void;
  onMover: (dir: "arriba" | "abajo") => void;
  setEjercicios: (fn: (lista: EjercicioDeBloque[]) => EjercicioDeBloque[]) => void;
}) {
  const [agregando, setAgregando] = useState(false);

  async function agregar(ejercicioId: string | null) {
    setAgregando(false);
    if (!ejercicioId) return;
    const res = await guardar(() => agregarEjercicio(bloque.id, ejercicioId));
    if (res.ok) setEjercicios((l) => [...l, res.data]);
  }

  function mover(i: number, dir: "arriba" | "abajo") {
    const j = dir === "arriba" ? i - 1 : i + 1;
    const id = bloque.ejercicios[i]?.id;
    if (!id || j < 0 || j >= bloque.ejercicios.length) return;
    setEjercicios((l) => {
      const copia = [...l];
      [copia[i], copia[j]] = [copia[j]!, copia[i]!];
      return copia.map((x, k) => ({ ...x, orden: k + 1 }));
    });
    void guardar(() => moverEjercicio(id, dir));
  }

  return (
    <section className={s.bloque}>
      <CampoAuto
        etiqueta="Nombre del bloque"
        valor={bloque.nombre}
        onGuardar={(v) => {
          if (!v.trim()) return;
          onCambio({ nombre: v });
          void guardar(() => actualizarBloque(bloque.id, { nombre: v }));
        }}
      />
      <CampoAuto
        etiqueta="Indicación"
        valor={bloque.indicacion ?? ""}
        multilinea
        onGuardar={(v) => {
          onCambio({ indicacion: v || null });
          void guardar(() => actualizarBloque(bloque.id, { indicacion: v }));
        }}
      />
      <Flechas
        que={`bloque ${bloque.nombre}`}
        puedeArriba={idx > 0}
        puedeAbajo={idx < total - 1}
        onArriba={() => onMover("arriba")}
        onAbajo={() => onMover("abajo")}
        onQuitar={onQuitar}
      />

      {bloque.ejercicios.map((ej, i) => (
        <FilaEjercicio
          key={ej.id}
          ej={ej}
          idx={i}
          total={bloque.ejercicios.length}
          biblioteca={biblioteca}
          guardar={guardar}
          onCambio={(cambios) =>
            setEjercicios((l) => l.map((x) => (x.id === ej.id ? { ...x, ...cambios } : x)))
          }
          onMover={(dir) => mover(i, dir)}
          onQuitar={() => {
            if (!window.confirm("¿Quitar este ejercicio del bloque?")) return;
            setEjercicios((l) => l.filter((x) => x.id !== ej.id));
            void guardar(() => eliminarEjercicio(ej.id));
          }}
        />
      ))}

      {agregando ? (
        <SelectorEjercicio etiqueta="Agregar ejercicio" valor={null} biblioteca={biblioteca} onElegir={agregar} abiertoInicial />
      ) : (
        <button type="button" className={`${e.btn} ${e.btnSec}`} onClick={() => setAgregando(true)}>
          + Ejercicio
        </button>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ el editor
type Props = {
  plan: { id: string; nombre: string; tipo: string; nivel: string };
  personalizadoDe: string | null;
  alumnosActivos: number;
  sesiones: SesionEditor[];
  biblioteca: EjercicioBiblioteca[];
};

export function EditorPlan({ plan: planInicial, personalizadoDe, alumnosActivos, sesiones: inicial, biblioteca }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState(planInicial);
  const [sesiones, setSesiones] = useState(inicial);
  const [previo, setPrevio] = useState(inicial);
  if (inicial !== previo) {
    // Llegaron datos nuevos del servidor (por ejemplo, después de copiar una semana).
    setPrevio(inicial);
    setSesiones(inicial);
  }

  const [semana, setSemana] = useState(1);
  const [estado, setEstado] = useState<Estado>("ok");
  const [mensajeError, setMensajeError] = useState("");
  const pendientes = useRef(0);
  const [destino, setDestino] = useState("");
  const [copiando, setCopiando] = useState(false);

  const guardar: Guardar = async (fn) => {
    pendientes.current += 1;
    setEstado("guardando");
    const res = await fn().catch(() => ({ ok: false as const, error: "Sin conexión. Revisá tu internet." }));
    pendientes.current -= 1;
    if (!res.ok) {
      setEstado("error");
      setMensajeError(res.error);
    } else if (pendientes.current === 0) {
      setEstado("ok");
    }
    return res;
  };

  const sesionesDeSemana = sesiones.filter((x) => x.semana === semana);

  function editarBloques(sesionId: string, fn: (b: BloqueEditor[]) => BloqueEditor[]) {
    setSesiones((todas) => todas.map((x) => (x.id === sesionId ? { ...x, bloques: fn(x.bloques) } : x)));
  }

  async function nuevoBloque(sesionId: string) {
    const res = await guardar(() => agregarBloque(sesionId));
    if (res.ok) editarBloques(sesionId, (b) => [...b, res.data]);
  }

  function moverBloqueLocal(sesion: SesionEditor, i: number, dir: "arriba" | "abajo") {
    const j = dir === "arriba" ? i - 1 : i + 1;
    const id = sesion.bloques[i]?.id;
    if (!id || j < 0 || j >= sesion.bloques.length) return;
    editarBloques(sesion.id, (l) => {
      const copia = [...l];
      [copia[i], copia[j]] = [copia[j]!, copia[i]!];
      return copia.map((x, k) => ({ ...x, orden: k + 1 }));
    });
    void guardar(() => moverBloque(id, dir));
  }

  async function copiar() {
    const d = Number(destino);
    if (!d) return;
    const aviso =
      `Vas a reemplazar TODOS los bloques de la Semana ${d} con una copia de la Semana ${semana}. ` +
      `Lo que hoy tiene la Semana ${d} se pierde.` +
      (alumnosActivos ? ` Los cambios les llegan a los ${alumnosActivos} alumnos que tienen este plan.` : "") +
      " ¿Confirmás?";
    if (!window.confirm(aviso)) return;
    setCopiando(true);
    const res = await guardar(() => copiarSemana(plan.id, semana, d));
    setCopiando(false);
    if (res.ok) {
      setSemana(d);
      setDestino("");
      router.refresh();
    }
  }

  const guardarPlan = (campo: "nombre" | "tipo" | "nivel", valor: string) => {
    const nuevo = { ...plan, [campo]: valor };
    setPlan(nuevo);
    void guardar(() => actualizarPlan(plan.id, nuevo));
  };

  return (
    <>
      <div className={s.cabecera}>
        <Link href="/panel/planes" className={`${e.btn} ${e.btnSec}`}>
          ← Planes
        </Link>
        <div className={s.datosPlan}>
          <CampoAuto etiqueta="Nombre del plan" valor={plan.nombre} onGuardar={(v) => v.trim() && guardarPlan("nombre", v)} />
          <CampoAuto etiqueta="Tipo" valor={plan.tipo} onGuardar={(v) => v.trim() && guardarPlan("tipo", v)} />
          <CampoAuto etiqueta="Nivel" valor={plan.nivel} onGuardar={(v) => guardarPlan("nivel", v)} />
        </div>
        <p
          className={`${s.estado} ${estado === "error" ? s.estadoError : ""}`}
          role="status"
          aria-live="polite"
        >
          {estado === "guardando" && "Guardando…"}
          {estado === "ok" && "✓ Guardado"}
          {estado === "error" && `No se pudo guardar: ${mensajeError}`}
        </p>
      </div>

      {personalizadoDe ? (
        <p className={s.aviso}>Plan personalizado de {personalizadoDe}. Los cambios solo le llegan a esa persona.</p>
      ) : (
        alumnosActivos > 0 && (
          <p className={s.aviso} role="note">
            Este plan lo tienen {alumnosActivos} {alumnosActivos === 1 ? "alumno" : "alumnos"}. Los cambios les llegan a todos.
          </p>
        )
      )}

      <div className={s.semanas} role="tablist" aria-label="Semanas">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={semana === n}
            className={`${s.tab} ${semana === n ? s.tabActiva : ""}`}
            onClick={() => setSemana(n)}
          >
            Semana {n}
          </button>
        ))}
        <div className={s.copiar}>
          <label htmlFor="copiar-destino">Copiar esta semana a</label>
          <select id="copiar-destino" className={e.select} value={destino} onChange={(ev) => setDestino(ev.target.value)}>
            <option value="">Elegí…</option>
            {[1, 2, 3, 4]
              .filter((n) => n !== semana)
              .map((n) => (
                <option key={n} value={n}>
                  Semana {n}
                </option>
              ))}
          </select>
          <button type="button" className={`${e.btn} ${e.btnSec}`} disabled={!destino || copiando} onClick={copiar}>
            {copiando ? "Copiando…" : "Copiar semana"}
          </button>
        </div>
      </div>

      <div className={s.grilla} role="tabpanel" aria-label={`Semana ${semana}`}>
        {sesionesDeSemana.map((ses) => (
          <div key={ses.id} className={s.columna}>
            <h2 className={s.estimulo}>Estímulo {ses.estimulo}</h2>
            {ses.bloques.map((b, i) => (
              <TarjetaBloque
                key={b.id}
                bloque={b}
                idx={i}
                total={ses.bloques.length}
                biblioteca={biblioteca}
                guardar={guardar}
                onCambio={(cambios) => editarBloques(ses.id, (l) => l.map((x) => (x.id === b.id ? { ...x, ...cambios } : x)))}
                onMover={(dir) => moverBloqueLocal(ses, i, dir)}
                onQuitar={() => {
                  if (!window.confirm(`¿Quitar el bloque “${b.nombre}” y sus ejercicios?`)) return;
                  editarBloques(ses.id, (l) => l.filter((x) => x.id !== b.id));
                  void guardar(() => eliminarBloque(b.id));
                }}
                setEjercicios={(fn) =>
                  editarBloques(ses.id, (l) => l.map((x) => (x.id === b.id ? { ...x, ejercicios: fn(x.ejercicios) } : x)))
                }
              />
            ))}
            <button type="button" className={e.btn} onClick={() => nuevoBloque(ses.id)}>
              + Bloque
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
