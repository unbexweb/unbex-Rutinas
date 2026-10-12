import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { RegistrarSW } from "@/components/pwa/RegistrarSW";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "Unbex Rutinas",
  description: "Tus rutinas de entrenamiento, siempre a mano.",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Unbex", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4B2556",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={montserrat.variable}>
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}