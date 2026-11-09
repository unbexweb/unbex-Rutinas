export type EjercicioDeBloque = {
  id: string;
  orden: number;
  ejercicio_id: string;
  alternativa_id: string | null;
  series: string | null;
  reps: string | null;
  carga_sugerida: string | null;
  registra_carga: boolean;
  nota: string | null;
  // Super serie: letra A, B, C… (los del mismo grupo dentro de un bloque se hacen seguidos)
  grupo: string | null;
};

export type BloqueEditor = {
  id: string;
  orden: number;
  nombre: string;
  indicacion: string | null;
  ejercicios: EjercicioDeBloque[];
};

export type SesionEditor = {
  id: string;
  semana: number;
  estimulo: number;
  bloques: BloqueEditor[];
};

export type EjercicioBiblioteca = { id: string; nombre: string; activo: boolean };

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export type CambiosEjercicio = Partial<
  Pick<
    EjercicioDeBloque,
    "ejercicio_id" | "alternativa_id" | "series" | "reps" | "carga_sugerida" | "registra_carga" | "nota" | "grupo"
  >
>;
