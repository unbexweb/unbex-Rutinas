import styles from "./Mensaje.module.css";

type Props = { tipo?: "error" | "exito" | "info"; children: React.ReactNode };

export function Mensaje({ tipo = "info", children }: Props) {
  return (
    <p className={`${styles.mensaje} ${styles[tipo]}`} role={tipo === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}
