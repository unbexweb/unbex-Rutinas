"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cerrarSesion } from "@/lib/auth/acciones";
import styles from "./Shell.module.css";

type Props = { nombre: string; esAdmin: boolean; children: React.ReactNode };

export function Shell({ nombre, esAdmin, children }: Props) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  const items = [
    { href: "/panel", texto: "Inicio" },
    { href: "/panel/alumnos", texto: "Alumnos" },
    { href: "/panel/solicitudes", texto: "Solicitudes" },
    { href: "/panel/planes", texto: "Planes" },
    { href: "/panel/ejercicios", texto: "Ejercicios" },
    ...(esAdmin ? [{ href: "/panel/profes", texto: "Profes" }] : []),
  ];
  const activo = (href: string) => (href === "/panel" ? pathname === href : pathname.startsWith(href));

  return (
    <div className={styles.shell}>
      <header className={styles.barra}>
        <button
          type="button"
          className={styles.hamburguesa}
          aria-expanded={abierto}
          aria-controls="menu-staff"
          onClick={() => setAbierto((a) => !a)}
        >
          <span aria-hidden="true">{abierto ? "✕" : "☰"}</span>
          <span>Menú</span>
        </button>
        <strong>Unbex Rutinas</strong>
      </header>

      <aside id="menu-staff" className={`${styles.menu} ${abierto ? styles.abierto : ""}`}>
        <p className={styles.marca}>Unbex Rutinas</p>
        <nav aria-label="Secciones del panel">
          <ul className={styles.lista}>
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.link} ${activo(item.href) ? styles.activo : ""}`}
                  aria-current={activo(item.href) ? "page" : undefined}
                  onClick={() => setAbierto(false)}
                >
                  {item.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.pie}>
          <p className={styles.usuario}>{nombre}</p>
          <form action={cerrarSesion}>
            <button type="submit" className={styles.salir}>
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className={styles.contenido}>{children}</main>
    </div>
  );
}
