// Carga videos de demostración PROVISORIOS (YouTube público) en los ejercicios del plan Volumen.
// Cada video se verifica contra https://www.youtube.com/oembed antes de guardarlo: tiene que responder 200
// (existe y se puede embeber) y su título tiene que contener las palabras clave del ejercicio.
//
// Por defecto NO escribe nada: solo verifica y muestra la lista ejercicio → título.
//   Verificar:  pnpm tsx --env-file=.env.local scripts/cargar-videos-demo.ts
//   Cargar:     pnpm tsx --env-file=.env.local scripts/cargar-videos-demo.ts --cargar
//
// Un ejercicio que ya tiene video propio NO se pisa (salvo con --pisar). Quedan sin video, a propósito,
// los que no tienen un video claro que los muestre (ver SIN_VIDEO). Los IDs salen de búsquedas reales.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

// nombre del ejercicio en la biblioteca (con * al final: empieza con) → id del video y palabras clave del título.
// Cada clave puede tener alternativas separadas por "|"; tienen que estar todas las claves (sin acentos ni mayúsculas).
const VIDEOS: [nombre: string, id: string, claves: string[]][] = [
  ["Aperturas Bco INCLIADO", "C4FwYsChO5Y", ["apertura", "inclinad"]],
  ["Aperturas Bco Plano", "YYdhEMKlilo", ["apertura", "plano"]],
  ["Back Squat", "dsCuiccYNGs", ["sentadilla|squat"]],
  ["Bench Press", "uEtiwYaT3d0", ["press de banca|bench press"]],
  ["Bench Press INCLINADO", "RkveusFgV30", ["press inclinado|incline"]],
  ["Box Dips", "V1K9BFx9OeM", ["fondos|dips", "banco|bench"]],
  ["Bulgarian Dead LIft", "D136QYD7tS8", ["deadlift|peso muerto", "bulgaro"]],
  ["Bulgarian Squats", "IdilLr9nyuQ", ["sentadilla|squat", "bulgara"]],
  ["Cable Side Kick", "pq6yI87oMFU", ["patada", "polea|cable"]],
  ["Camilla de Cuadriceps", "rf5Nxw0vaOc", ["extension", "maquina"]],
  ["Camilla de Isquios", "OYoW4IzWdrw", ["femoral", "maquina"]],
  ["Chin UPS HOLD", "QWaY882IjKg", ["chin", "hold"]],
  ["Clam Shell", "yEKxclDIt1A", ["clam"]],
  ["Coppenhegen Plank", "DpXug2f7K08", ["copenhague|copenhagen"]],
  ["Curl de Biceps c/Db", "rqy0oxx__sU", ["curl", "mancuerna"]],
  ["Curl de Biceps c/Polea", "ZzjMo9mzrHg", ["polea", "curl|biceps"]],
  ["Curtsy Squats ALT", "4CuzJjsA-R4", ["reverencia|curtsy"]],
  ["Cycling Squats", "aoNyKjQvegs", ["cyclist|cycling|ciclista"]],
  ["Dead Lift", "59KftU68hHQ", ["peso muerto|deadlift"]],
  ["Dorsalera", "EO9AmI-bu_0", ["jalon"]],
  ["Dorsalera Toma amplia", "WakfOFnr5oM", ["jalon", "amplio|ancho"]],
  ["Farmer Carry*", "69hTPgHwA08", ["granjero|farmer"]],
  ["Glute Kick Back", "cV9ylFjgJtI", ["gluteo|glute", "polea|cable"]],
  ["Good Morning", "3QTVbkT30E0", ["good morning|buenos dias"]],
  ["Heels Touch", "SOT8a1FUN7I", ["heel"]],
  ["Hip Thrust ISO / ALT", "cGJ669fWbN8", ["hip thrust", "isometric"]],
  ["Hip Thrust UNIL", "VUzt0rUnRdY", ["hip thrust", "pierna"]],
  ["Hollow Rocks", "TjgEN0N-y2c", ["hollow"]],
  ["Inverted Row", "ryTumE86-O4", ["remo invertido|inverted row"]],
  ["K2E Estrictos", "AQwJHrXin-Q", ["knee", "elbow"]],
  ["KB Row", "zFjui9Ye1J4", ["remo", "kettlebell"]],
  ["KB Row UNIL", "lGgaFFLrwMU", ["kettlebell|kb", "unilateral|1 arm"]],
  ["Lateral Plank Dinamico", "iawL9lyG9nU", ["plancha lateral", "dinamica"]],
  ["Lunges", "gItknnU0qkM", ["lunge|zancada"]],
  ["Monster Walk c/banda", "8egU29uXnm4", ["monster walk"]],
  ["Pendaly Row", "Vuv1ki3tk0E", ["pendlay"]],
  ["Plank CODOS", "MjblcRQMSfI", ["plancha", "codos"]],
  ["Plank to Walk OUT", "wJe1-IURnk8", ["inchworm|walkout"]],
  ["Pull UPS", "8mhDd9Ahl1M", ["dominada"]],
  ["Push UPS Diamante", "yzU8tE28ePE", ["diamante"]],
  ["Remo Polea", "nwdptbhYjTw", ["remo", "polea"]],
  ["Russian Twist", "-4An9bsi60s", ["russian twist|giros rusos|twist ruso"]],
  ["Shoulder Press", "7J0b8aGWwqk", ["shoulder press|press hombro"]],
  ["Sit UPS", "oUpADVmt9W8", ["sit up"]],
  ["Step UPS", "FtjkiNJHhJ8", ["subida|step up"]],
  ["Toes Touch", "zHbxwCy1KTI", ["punta", "pies|pie"]],
  ["Triceps c/polea", "4n7lu4dVcoQ", ["triceps", "polea"]],
  ["Tricpes Frances Acostado c/db", "gmL9x27VG7M", ["press frances", "mancuerna"]],
  ["Vuelos Laterales", "V3LaKO8iZUE", ["elevaciones laterales|vuelos laterales"]],
  ["Vuelos Posteriores", "29AM-enz1tA", ["vuelos posteriores"]],
];

// Sin video a propósito: el nombre del plan es ambiguo y no se encontró uno confiable.
const SIN_VIDEO: Record<string, string> = {
  "DB Press UNIL": "no queda claro si es press de pecho o de hombro unilateral con mancuerna",
  "Deficit SDL": "SDL puede ser stiff-leg, sumo o a una pierna; no se sabe cuál",
  "Doble Press ALT": "no queda claro qué press es (pecho u hombro, alterno)",
  "Triple Crush": "no hay un ejercicio conocido con ese nombre",
};

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

async function oembed(id: string): Promise<{ status: number; title?: string; autor?: string }> {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
  const res = await fetch(url);
  if (res.status !== 200) return { status: res.status };
  const j = (await res.json()) as { title?: string; author_name?: string };
  return { status: 200, title: j.title, autor: j.author_name };
}

async function main() {
  const cargar = process.argv.includes("--cargar");
  const pisar = process.argv.includes("--pisar");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: gym } = await db.from("gyms").select("id").eq("slug", process.env.GYM_SLUG ?? "unbex").single();
  if (!gym) throw new Error("No existe el gimnasio");
  const { data: ejercicios, error } = await db
    .from("ejercicios")
    .select("id, nombre, youtube_id")
    .eq("gym_id", gym.id);
  if (error) throw error;

  let bien = 0;
  const problemas: string[] = [];
  console.log(cargar ? "CARGANDO videos:\n" : "VERIFICACIÓN (no se escribe nada):\n");

  for (const [nombre, id, claves] of VIDEOS) {
    const ej = ejercicios?.find((e) => (nombre.endsWith("*") ? e.nombre.startsWith(nombre.slice(0, -1)) : e.nombre === nombre));
    if (!ej) {
      problemas.push(`${nombre}: no existe en la biblioteca`);
      continue;
    }
    const r = await oembed(id);
    if (r.status !== 200) {
      problemas.push(`${nombre}: el video ${id} respondió ${r.status} (no existe o no se puede embeber)`);
      continue;
    }
    const titulo = normalizar(r.title ?? "");
    const faltan = claves.filter((c) => !c.split("|").some((alt) => titulo.includes(alt)));
    if (faltan.length) {
      problemas.push(`${nombre}: el título "${r.title}" no menciona ${faltan.join(" / ")}`);
      continue;
    }

    let nota = "";
    if (cargar) {
      if (ej.youtube_id && !pisar) nota = "  (ya tenía video: no se pisa)";
      else {
        const { error: e } = await db
          .from("ejercicios")
          .update({ youtube_id: id, video_url: `https://www.youtube.com/watch?v=${id}` })
          .eq("id", ej.id);
        if (e) throw e;
        nota = "  ✓ cargado";
      }
    }
    bien++;
    console.log(`${ej.nombre}  →  ${r.title}  [${r.autor}]  https://youtu.be/${id}${nota}`);
  }

  console.log(`\n${bien} videos verificados de ${VIDEOS.length}.`);
  if (problemas.length) {
    console.log("\nProblemas (estos NO se cargan):");
    for (const p of problemas) console.log("  - " + p);
  }
  console.log("\nSin video a propósito:");
  for (const [n, motivo] of Object.entries(SIN_VIDEO)) console.log(`  - ${n}: ${motivo}`);
  if (!cargar) console.log("\nPara cargarlos, volvé a correrlo con --cargar.");
  if (problemas.length) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
