"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavInferior.module.css";

const ITEMS = [
  { href: "/inicio", texto: "Inicio", icono: "🏠" },
  { href: "/plan", texto: "Mi plan", icono: "📅" },
  { href: "/ficha", texto: "Ficha", icono: "📋" },
];

export function NavInferior() {
  const pathname = usePathname();
  // Durante el entrenamiento la barra de abajo es la de Anterior / Siguiente.
  if (pathname.startsWith("/entrenar")) return null;

  return (
    <nav className={styles.nav} aria-label="Navegación principal">
      {ITEMS.map((item) => {
        const activo = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.item} ${activo ? styles.activo : ""}`}
            aria-current={activo ? "page" : undefined}
          >
            <span aria-hidden="true" className={styles.icono}>
              {item.icono}
            </span>
            {item.texto}
          </Link>
        );
      })}
    </nav>
  );
}
