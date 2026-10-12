// Crea (o reinicia) un alumno de prueba activo con el plan Volumen asignado.
// Uso: pnpm tsx --env-file=.env.local scripts/crear-alumno-prueba.ts
// Usa la service role key: correrlo solo en tu máquina.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const EMAIL = "alumno.prueba@unbex.test";
const DNI = "99000001";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: gym } = await admin
    .from("gyms")
    .select("id")
    .eq("slug", process.env.GYM_SLUG ?? "unbex")
    .single();
  if (!gym) throw new Error("No existe el gimnasio");

  const { data: plan } = await admin
    .from("planes")
    .select("id")
    .eq("gym_id", gym.id)
    .eq("nombre", "Volumen")
    .is("alumno_id", null)
    .single();
  if (!plan) throw new Error("No existe el plan Volumen");

  const password = `Prueba-${randomBytes(4).toString("hex")}`;

  let { data: perfil } = await admin.from("profiles").select("id").eq("dni", DNI).maybeSingle();
  if (perfil) {
    const { error } = await admin.auth.admin.updateUserById(perfil.id, { password });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: { nombre: "Alumno", apellido: "Prueba", dni: DNI, gym_id: gym.id },
    });
    if (error) throw error;
    perfil = { id: data.user.id };
  }

  const { error: errPerfil } = await admin
    .from("profiles")
    .update({ estado: "activo" })
    .eq("id", perfil.id);
  if (errPerfil) throw errPerfil;

  // Reinicia: borra asignaciones previas (cascada a registros y solicitudes) y asigna Volumen.
  const { error: errBorrar } = await admin.from("asignaciones").delete().eq("alumno_id", perfil.id);
  if (errBorrar) throw errBorrar;
  const { error: errAsig } = await admin
    .from("asignaciones")
    .insert({ alumno_id: perfil.id, plan_id: plan.id });
  if (errAsig) throw errAsig;

  console.log("Alumno de prueba listo (plan Volumen, Semana 1 · Estímulo 1):");
  console.log(`  Email:      ${EMAIL}`);
  console.log(`  DNI:        ${DNI}`);
  console.log(`  Contraseña: ${password}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
