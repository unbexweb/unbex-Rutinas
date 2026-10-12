import type { MetadataRoute } from "next";

// El manifest no puede leer variables CSS: estos valores son --color-violeta y --color-rosa de app/globals.css.
const VIOLETA = "#4B2556";
const ROSA = "#FDE3D8";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Unbex Rutinas",
    short_name: "Unbex",
    description: "Tus rutinas de entrenamiento, siempre a mano.",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: VIOLETA,
    background_color: ROSA,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
