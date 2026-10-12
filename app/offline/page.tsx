import { Boton } from "@/components/ui/Boton";
import { Pantalla } from "@/components/ui/Pantalla";

export const metadata = { title: "Sin conexión · Unbex Rutinas" };

// Página estática, sin datos del usuario: es la única que guarda el service worker.
export default function OfflinePage() {
  return (
    <Pantalla titulo="Sin conexión">
      <p>Sin conexión. Cuando vuelvas a tener señal, seguí donde estabas.</p>
      <Boton href="/">Reintentar</Boton>
    </Pantalla>
  );
}
