export type EjercicioVista = {
  id: string;
  nombre: string;
  youtubeId: string | null;
  videoUrl: string | null;
};

// Una serie: lo escrito (peso, reps) y si está tildada como hecha.
export type SerieVista = { peso: string; reps: string; hecha: boolean };

// Lo que hizo la última vez en esa misma serie (n_serie), para la columna "Anterior".
export type SerieAnterior = { peso: string; reps: string };

export type ItemVista = {
  beId: string;
  bloqueId: string;
  bloqueNombre: string;
  bloqueIndicacion: string | null;
  // Super serie: letra A, B, C… (los ejercicios del mismo grupo dentro de un bloque se hacen seguidos).
  grupo: string | null;
  // Tal cual los cargó el profe: no se interpretan ni se traducen.
  series: string | null;
  reps: string | null;
  cargaSugerida: string | null;
  nota: string | null;
  registraCarga: boolean;
  ejercicio: EjercicioVista;
  alternativa: EjercicioVista | null;
  nSeries: number;
  guardado: { ejercicioUsadoId: string | null; series: SerieVista[]; hecho: boolean };
  // Por ejercicio (id del ejercicio): las series de la última vez que lo hizo.
  anterior: Record<string, SerieAnterior[]>;
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
