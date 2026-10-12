// Extrae el id de un video de YouTube desde watch?v=, youtu.be/, shorts/, embed/ o live/.
// También acepta el id pelado (11 caracteres). Devuelve null si no reconoce nada.
const ID = /^[\w-]{11}$/;

export function extraerYoutubeId(entrada: string): string | null {
  const valor = entrada.trim();
  if (!valor) return null;
  if (ID.test(valor)) return valor;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(valor) ? valor : `https://${valor}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let candidato: string | null = null;

  if (host === "youtu.be") {
    candidato = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, tipo, id] = url.pathname.split("/");
    if (url.pathname === "/watch") candidato = url.searchParams.get("v");
    else if (tipo && ["shorts", "embed", "live", "v"].includes(tipo)) candidato = id ?? null;
  }

  return candidato && ID.test(candidato) ? candidato : null;
}
