"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import styles from "./Boton.module.css";

type Props = {
  children: React.ReactNode;
  variante?: "primario" | "secundario";
  href?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  cargando?: boolean;
};

export function Boton({
  children,
  variante = "primario",
  href,
  type = "submit",
  onClick,
  disabled,
  cargando,
}: Props) {
  const { pending } = useFormStatus();
  const ocupado = pending || cargando;
  const clase = `${styles.boton} ${styles[variante]}`;

  if (href) {
    return (
      <Link href={href} className={clase}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      className={clase}
      onClick={onClick}
      disabled={disabled || ocupado}
      aria-busy={ocupado}
    >
      {ocupado ? "Un momento…" : children}
    </button>
  );
}
