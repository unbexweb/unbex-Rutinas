// Borra de TODOS los planes los bloques cuyo nombre empieza con "Movilidad" o "Activación"
// (sin distinguir mayúsculas ni acentos). Sus ejercicios se borran con ellos.
//
// Por defecto NO borra nada: solo muestra cuántos va a borrar.
//   Simulacro:  pnpm tsx --env-file=.env.local scripts/borrar-movilidad-activacion.ts
//   Ejecutar:   pnpm tsx --env-file=.env.local scripts/borrar-movilidad-activacion.ts --ejecutar
//
// Las series que alumnos ya registraron en esos ejercicios NO se pierden: quedan con
// bloque_ejercicio_id nulo (peso, reps y ejercicio_usado_id se conservan). Las marcas de "hecho"
// de esos ejercicios sí se borran (no tienen valor sin el ejercicio).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const esDeMovilidad = (nombre: string) => {
  const n = normalizar(nombre);
  return n.startsWith("movilidad") || n.startsWith("activacion");
};

async function main() {
  const ejecutar = process.argv.includes("--ejecutar");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: bloques, error } = await db
    .from("bloques")
    .select("id, nombre, sesion:sesiones!inner(plan:planes!inner(id, nombre, alumno_id))");
  if (error) throw error;

  const elegidos = (bloques ?? []).filter((b) => esDeMovilidad(b.nombre));
  const ids = elegidos.map((b) => b.id);

  const contar = async (tabla: "bloque_ejercicios" | "registros_series" | "registros_ejercicios", col: string, valores: string[]) => {
    let total = 0;
    for (let i = 0; i < valores.length; i += 100) {
      const { count, error: e } = await db
        .from(tabla)
        .select("id", { count: "exact", head: true })
        .in(col, valores.slice(i, i + 100));
      if (e) throw e;
      total += count ?? 0;
    }
    return total;
  };

  // ejercicios de esos bloques (para contar lo que cuelga de ellos)
  const beIds: string[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error: e } = await db.from("bloque_ejercicios").select("id").in("bloque_id", ids.slice(i, i + 100));
    if (e) throw e;
    beIds.push(...(data ?? []).map((x) => x.id));
  }
  const seriesAfectadas = await contar("registros_series", "bloque_ejercicio_id", beIds);
  const marcasAfectadas = await contar("registros_ejercicios", "bloque_ejercicio_id", beIds);

  const porPlan = new Map<string, { bloques: number; esPersonalizado: boolean }>();
  for (const b of elegidos) {
    const plan = b.sesion.plan;
    const clave = `${plan.nombre}${plan.alumno_id ? " (personalizado)" : ""}`;
    const actual = porPlan.get(clave) ?? { bloques: 0, esPersonalizado: Boolean(plan.alumno_id) };
    actual.bloques += 1;
    porPlan.set(clave, actual);
  }
  const porNombre = new Map<string, number>();
  for (const b of elegidos) porNombre.set(b.nombre, (porNombre.get(b.nombre) ?? 0) + 1);

  console.log(ejecutar ? "EJECUTANDO el borrado:" : "SIMULACRO (no se borra nada):");
  console.log(`  Bloques a borrar:               ${elegidos.length}`);
  for (const [nombre, n] of porNombre) console.log(`    · "${nombre}": ${n}`);
  console.log(`  Ejercicios dentro de esos bloques: ${beIds.length}`);
  console.log(`  Series ya registradas por alumnos que quedan sin vínculo (se conservan): ${seriesAfectadas}`);
  console.log(`  Marcas de "hecho" que se borran: ${marcasAfectadas}`);
  console.log("  Por plan:");
  for (const [plan, v] of [...porPlan].sort()) console.log(`    · ${plan}: ${v.bloques} bloques`);

  if (!ejecutar) {
    console.log("\nPara borrar de verdad, volvé a correrlo con --ejecutar.");
    return;
  }

  let borrados = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { data, error: e } = await db.from("bloques").delete().in("id", lote).select("id");
    if (e) throw e;
    borrados += data?.length ?? 0;
  }
  console.log(`\nListo: ${borrados} bloques borrados.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
