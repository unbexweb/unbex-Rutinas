export type EjercicioVista = {
  id: string;
  nombre: string;
  youtubeId: string | null;
  videoUrl: string | null;
};

export type SerieVista = { peso: string; reps: string };

export type ItemVista = {
  beId: string;
  bloqueNombre: string;
  bloqueIndicacion: string | null;
  // Tal cual los cargó el profe: no se interpretan ni se traducen.
  series: string | null;
  reps: string | null;
  cargaSugerida: string | null;
  nota: string | null;
  registraCarga: boolean;
  ejercicio: EjercicioVista;
  alternativa: EjercicioVista | null;
  nSeries: number;
  guardado: { ejercicioUsadoId: string | null; series: SerieVista[] };
  // "La última vez" por ejercicio (id del ejercicio → texto), o null si no hay datos.
  ultima: Record<string, string | null>;
};

export type EntrenamientoVista = {
  sesionId: string;
  asignacionId: string;
  semana: number;
  estimulo: number;
  modo: "editar" | "leer";
  items: ItemVista[];
};

export type ResultadoAccion = { ok: true } | { ok: false; error: string };
