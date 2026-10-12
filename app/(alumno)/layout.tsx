import { NavInferior } from "@/components/alumno/NavInferior";
import { requerirUsuario } from "@/lib/auth/usuario";
import styles from "./layout.module.css";

export default async function AlumnoLayout({ children }: { children: React.ReactNode }) {
  await requerirUsuario("alumno");
  return (
    <div className={styles.app}>
      {children}
      <NavInferior />
    </div>
  );
}
