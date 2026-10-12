import styles from "./Pantalla.module.css";

// Contenedor de una columna, pensado para celular.
export function Pantalla({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className={styles.pantalla}>
      <h1 className={styles.titulo}>{titulo}</h1>
      {children}
    </main>
  );
}
