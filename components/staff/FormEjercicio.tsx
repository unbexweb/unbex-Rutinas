"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Mensaje } from "@/components/ui/Mensaje";
import type { EstadoForm } from "@/lib/auth/validar";
import { extraerYoutubeId } from "@/lib/youtube";
import e from "./estilos.module.css";

type Props = {
  accion: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  inicial?: { id: string; nombre: string; video_url: string; descripcion: string };
};

export function FormEjercicio({ accion, inicial }: Props) {
  const [estado, enviar] = useActionState<EstadoForm, FormData>(accion, {});
  const v = estado.valores ?? inicial;
  const [url, setUrl] = useState(v?.video_url ?? "");
  const youtubeId = extraerYoutubeId(url);

  return (
    <form action={enviar} className={`${e.panel} ${e.stack}`} style={{ maxWidth: "36rem", marginBottom: "var(--space-6)" }}>
      <h2>{inicial ? "Editar ejercicio" : "Nuevo ejercicio"}</h2>
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <Campo name="nombre" label="Nombre" defaultValue={v?.nombre} error={estado.errores?.nombre} required />
      <Campo
        name="video_url"
        label="Video de YouTube (opcional)"
        inputMode="url"
        autoCapitalize="none"
        ayuda="Pegá el link: youtube.com/watch?v=…, youtu.be/… o youtube.com/shorts/…"
        value={url}
        onChange={(ev) => setUrl(ev.target.value)}
      />
      {youtubeId ? (
        <div>
          <p className={e.ayuda}>Vista previa (id del video: {youtubeId})</p>
          <div style={{ aspectRatio: "16 / 9", maxWidth: "28rem" }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
              title="Vista previa del video"
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: 0, borderRadius: "var(--radius)" }}
            />
          </div>
        </div>
      ) : (
        url.trim() && (
          <p className={e.error}>
            No reconocemos ese link como un video de YouTube. Se guarda igual, pero no se va a poder ver dentro de la app.
          </p>
        )
      )}
      <Campo name="descripcion" label="Descripción corta (opcional)" defaultValue={v?.descripcion} />
      <div className={e.fila}>
        <div style={{ minWidth: "10rem" }}>
          <Boton>Guardar</Boton>
        </div>
        <Link href="/panel/ejercicios" className={`${e.btn} ${e.btnSec}`}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
