"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import styles from "./Boton.module.css";

type Props = {
  children: React.ReactNode;
  variante?: "primario" | "secundario";
  href?: string;
  type?: "button" | "submit";
};

export function Boton({ children, variante = "primario", href, type = "submit" }: Props) {
  const { pending } = useFormStatus();
  const clase = `${styles.boton} ${styles[variante]}`;

  if (href) {
    return (
      <Link href={href} className={clase}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={clase} disabled={pending} aria-busy={pending}>
      {pending ? "Un momento…" : children}
    </button>
  );
}
