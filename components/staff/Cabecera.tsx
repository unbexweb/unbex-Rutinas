import e from "./estilos.module.css";

export function Cabecera({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className={e.cabecera}>
      <h1 className={e.titulo}>{titulo}</h1>
      {children && <div className={e.fila}>{children}</div>}
    </div>
  );
}

export function Insignia({ estado }: { estado: "pendiente" | "activo" | "inactivo" }) {
  const clase =
    estado === "activo" ? e.insigniaActivo : estado === "inactivo" ? e.insigniaInactivo : e.insigniaPendiente;
  const texto = estado === "activo" ? "Activo" : estado === "inactivo" ? "Inactivo" : "Pendiente";
  return <span className={`${e.insignia} ${clase}`}>{texto}</span>;
}
