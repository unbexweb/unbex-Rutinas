// Crea (o promueve) un usuario admin activo y le pone una contraseña temporal nueva.
// Uso: pnpm tsx --env-file=.env.local scripts/crear-admin.ts <email> <dni> <nombre> <apellido>
// Sin argumentos crea el admin de prueba. Usa la service role key: correrlo solo en tu máquina.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

async function main() {
  const [email = "admin.prueba@unbex.test", dni = "99000002", nombre = "Admin", apellido = "Prueba"] =
    process.argv.slice(2);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  if (!/^\d{7,8}$/.test(dni)) throw new Error("El DNI tiene que tener 7 u 8 números");

  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: gym } = await admin
    .from("gyms")
    .select("id")
    .eq("slug", process.env.GYM_SLUG ?? "unbex")
    .single();
  if (!gym) throw new Error("No existe el gimnasio");

  const password = `Admin-${randomBytes(4).toString("hex")}`;

  let { data: perfil } = await admin.from("profiles").select("id").eq("dni", dni).maybeSingle();
  if (perfil) {
    const { error } = await admin.auth.admin.updateUserById(perfil.id, { password });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, apellido, dni, gym_id: gym.id },
    });
    if (error) throw error;
    perfil = { id: data.user.id };
  }

  const { error } = await admin
    .from("profiles")
    .update({ rol: "admin", estado: "activo" })
    .eq("id", perfil.id);
  if (error) throw error;

  console.log("Admin listo:");
  console.log(`  Email:      ${email}`);
  console.log(`  DNI:        ${dni}`);
  console.log(`  Contraseña: ${password}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
