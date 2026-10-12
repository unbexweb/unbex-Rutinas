import "server-only";
import { randomInt } from "node:crypto";
import type { Usuario } from "@/lib/auth/usuario";
import { esDni, esEmail, soloDigitos } from "@/lib/auth/validar";
import { createAdminClient } from "@/lib/supabase/admin";

export type DatosNuevoUsuario = {
  rol: "alumno" | "profe";
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
};

export type ResultadoCrear =
  | { ok: true; password: string; id: string }
  | { ok: false; errores?: Record<string, string>; error?: string };

// Sin 0/O/1/l/I para que se pueda dictar por teléfono.
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generarPasswordTemporal(largo = 10): string {
  return Array.from({ length: largo }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
}

// Usa el cliente admin: exige un `llamador` ya verificado (staff activo; admin para crear profes)
// y toma el gym SIEMPRE del llamador, nunca de un dato del formulario.
export async function crearUsuario(llamador: Usuario, datos: DatosNuevoUsuario): Promise<ResultadoCrear> {
  const { rol: rolLlamador, estado, gym_id } = llamador.profile;
  const esStaff = estado === "activo" && (rolLlamador === "admin" || rolLlamador === "profe");
  if (!esStaff || (datos.rol === "profe" && rolLlamador !== "admin")) {
    return { ok: false, error: "No tenés permiso para hacer esto." };
  }

  const nombre = datos.nombre.trim();
  const apellido = datos.apellido.trim();
  const dni = soloDigitos(datos.dni);
  const email = datos.email.trim().toLowerCase();

  const errores: Record<string, string> = {};
  if (!nombre) errores.nombre = "Ingresá el nombre";
  if (!apellido) errores.apellido = "Ingresá el apellido";
  if (!esDni(dni)) errores.dni = "El DNI tiene que tener 7 u 8 números";
  if (!esEmail(email)) errores.email = "Ingresá un email válido";
  if (Object.keys(errores).length) return { ok: false, errores };

  const admin = createAdminClient();

  const { data: porDni } = await admin.from("profiles").select("id").eq("dni", dni).maybeSingle();
  if (porDni) return { ok: false, errores: { dni: "Ya hay una cuenta con ese DNI" } };
  const { data: porEmail } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (porEmail) return { ok: false, errores: { email: "Ya hay una cuenta con ese email" } };

  const password = generarPasswordTemporal();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, apellido, dni, gym_id },
  });
  if (error || !data.user) {
    return { ok: false, error: "No pudimos crear la cuenta. Revisá los datos e intentá de nuevo." };
  }

  // El trigger crea el perfil como alumno pendiente; acá se lo deja activo y con su rol.
  const { error: errPerfil } = await admin
    .from("profiles")
    .update({ estado: "activo", rol: datos.rol })
    .eq("id", data.user.id)
    .eq("gym_id", gym_id);
  if (errPerfil) {
    return { ok: false, error: "La cuenta se creó pero no pudimos activarla. Activala desde la lista." };
  }

  return { ok: true, password, id: data.user.id };
}
