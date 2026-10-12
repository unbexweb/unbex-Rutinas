"use client";

import { useEffect } from "react";

// Registra el service worker (solo en producción: en desarrollo molesta con el hot reload).
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sin service worker la app funciona igual; solo se pierde la página offline.
    });
  }, []);
  return null;
}
