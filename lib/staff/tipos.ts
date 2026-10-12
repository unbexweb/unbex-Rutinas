export type ResultadoStaff =
  | { ok: true; irA?: string; mensaje?: string }
  | { ok: false; error: string };
