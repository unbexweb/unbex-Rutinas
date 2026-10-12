// Los mensajes de las funciones de la base ya están en español; los demás errores no se muestran.
export function mensajeDe(error: { code?: string; message: string } | null, generico: string): string {
  return error && ["P0002", "22023", "42501"].includes(error.code ?? "") ? error.message : generico;
}
