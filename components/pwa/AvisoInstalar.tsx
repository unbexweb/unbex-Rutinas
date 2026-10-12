"use client";

import { useEffect, useState } from "react";
import styles from "./AvisoInstalar.module.css";

const CLAVE = "unbex-aviso-instalar-cerrado";

// Evento no estándar de Chrome/Android.
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function yaInstalada(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function esIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ se presenta como Mac, pero tiene pantalla táctil.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function recordarCerrado() {
  try {
    localStorage.setItem(CLAVE, "1");
  } catch {
    // Sin localStorage (modo privado): vuelve a aparecer en la próxima visita.
  }
}

export function AvisoInstalar() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    let cerrado = false;
    try {
      cerrado = localStorage.getItem(CLAVE) === "1";
    } catch {
      // se muestra igual
    }
    if (cerrado || yaInstalada()) return;

    const alPedir = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setVisible(true);
    };
    const alInstalar = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", alPedir);
    window.addEventListener("appinstalled", alInstalar);

    if (esIos()) {
      setIos(true);
      setVisible(true);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", alPedir);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (!visible) return null;

  function cerrar() {
    recordarCerrado();
    setVisible(false);
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice.catch(() => null);
    setEvento(null);
    cerrar();
  }

  return (
    <aside className={styles.aviso} aria-label="Instalar la app">
      <div className={styles.texto}>
        <strong>Agregá la app a tu pantalla de inicio</strong>
        {ios && !evento && (
          <p>
            En tu iPhone: tocá <strong>Compartir</strong> <span aria-hidden="true">⬆️</span> y después{" "}
            <strong>Agregar a inicio</strong>.
          </p>
        )}
        {evento && <p>Así la abrís con un toque, como cualquier otra app.</p>}
      </div>
      <div className={styles.botones}>
        {evento && (
          <button type="button" className={styles.instalar} onClick={instalar}>
            Instalar
          </button>
        )}
        <button type="button" className={styles.cerrar} onClick={cerrar}>
          Cerrar
        </button>
      </div>
    </aside>
  );
}
