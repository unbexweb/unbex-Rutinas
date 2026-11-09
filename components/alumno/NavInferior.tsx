"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./NavInferior.module.css";

// Íconos simples en SVG (decorativos: el texto de abajo dice qué es).
const Icono = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const ITEMS = [
  {
    href: "/inicio",
    texto: "Inicio",
    icono: (
      <Icono>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10" />
        <path d="M10 20v-6h4v6" />
      </Icono>
    ),
  },
  {
    href: "/plan",
    texto: "Mi plan",
    icono: (
      <Icono>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </Icono>
    ),
  },
  {
    href: "/ficha",
    texto: "Ficha",
    icono: (
      <Icono>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v1M9 11h6M9 15h6" />
      </Icono>
    ),
  },
];

export function NavInferior() {
  const pathname = usePathname();
  // Durante el entrenamiento, abajo va el botón "Terminé".
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
            {item.icono}
            <span>{item.texto}</span>
          </Link>
        );
      })}
    </nav>
  );
}
