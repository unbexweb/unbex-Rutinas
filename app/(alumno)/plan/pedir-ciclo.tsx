"use client";

import { useState, type ReactNode } from "react";
import styles from "./plan.module.css";

// Botón "Pedir próximo ciclo": disponible siempre; al tocarlo se muestra el formulario.
export function PedirCiclo({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  if (abierto) return <>{children}</>;
  return (
    <button type="button" className={styles.pedir} onClick={() => setAbierto(true)}>
      Pedir próximo ciclo
    </button>
  );
}
