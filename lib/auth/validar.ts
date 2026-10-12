export const soloDigitos = (valor: string) => valor.replace(/\D/g, "");
export const esEmail = (valor: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
export const esDni = (valor: string) => /^\d{7,8}$/.test(valor);

export const MENSAJE_LOGIN = "DNI, email o contraseña incorrectos";

export type EstadoForm = {
  error?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  ok?: string;
};

export function texto(formData: FormData, nombre: string): string {
  const v = formData.get(nombre);
  return typeof v === "string" ? v.trim() : "";
}
