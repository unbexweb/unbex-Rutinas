// Pruebas de la base en PGlite (Postgres en memoria): migraciones + seed + RLS + funciones.
// Uso: pnpm test:db
// Simula lo mínimo de Supabase: roles anon/authenticated/service_role, auth.users y auth.uid().
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();
let ok = 0, mal = 0;

async function t(nombre, fn) {
  try { await fn(); ok++; console.log("ok   " + nombre); }
  catch (e) { mal++; console.log("FAIL " + nombre + "\n     " + e.message); }
}
async function falla(promesa, re) {
  try { await promesa; } catch (e) { assert.match(e.message, re); return; }
  assert.fail("tendría que haber fallado");
}
const cuenta = async (sql, args = []) => Number((await db.query(sql, args)).rows[0].n);

// ---------------------------------------------------------------- base
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to authenticated;
`);
for (const f of fs.readdirSync(path.join(RAIZ, "migrations")).sort()) {
  await db.exec(fs.readFileSync(path.join(RAIZ, "migrations", f), "utf8"));
}
await db.exec(fs.readFileSync(path.join(RAIZ, "seed.sql"), "utf8"));

const gym = (await db.query(`select id from gyms where slug='unbex'`)).rows[0].id;
const gym2 = (await db.query(`insert into gyms(nombre,slug) values ('Otro','otro') returning id`)).rows[0].id;
let dniN = 100;
async function usuario(email, g, rol, estado) {
  const id = (await db.query(
    `insert into auth.users(email, raw_user_meta_data)
     values ($1, jsonb_build_object('nombre','N','apellido','A','dni',$2::text,'gym_id',$3::text)) returning id`,
    [email, String(++dniN), g])).rows[0].id;
  await db.query(`update profiles set rol=$2, estado=$3 where id=$1`, [id, rol, estado]);
  return id;
}
// Ejecuta fn como un usuario autenticado (RLS activo).
async function como(uid, fn) {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
  await db.exec(`set role authenticated`);
  try { return await fn(); }
  finally { await db.exec(`reset role`); await db.query(`select set_config('request.jwt.claim.sub','',false)`); }
}

const profe = await usuario("profe@x", gym, "profe", "activo");
const profe2 = await usuario("profe2@x", gym2, "profe", "activo");
const alumno = await usuario("a1@x", gym, "alumno", "activo");
const alumno2 = await usuario("a2@x", gym, "alumno", "activo");
const pendiente = await usuario("pend@x", gym, "alumno", "pendiente");
const externo = await usuario("ext@x", gym2, "alumno", "activo");

const plan = (await db.query(`select id from planes where alumno_id is null and gym_id=$1 limit 1`, [gym])).rows[0].id;
const sesionDe = async (p, sem, est) =>
  (await db.query(`select id from sesiones where plan_id=$1 and semana=$2 and estimulo=$3`, [p, sem, est])).rows[0].id;
const ejerciciosDe = async (sesionId) =>
  (await db.query(
    `select be.id, be.ejercicio_id, be.alternativa_id, be.registra_carga, be.grupo, b.id as bloque_id
     from bloque_ejercicios be join bloques b on b.id = be.bloque_id
     where b.sesion_id = $1 order by b.orden, be.orden`, [sesionId])).rows;

// ================================================================ seed
await t("seed: 97 ejercicios y 24 sesiones en Volumen", async () => {
  assert.equal(await cuenta(`select count(*) n from ejercicios where gym_id=$1`, [gym]), 97);
  assert.equal(await cuenta(`select count(*) n from sesiones where plan_id=$1`, [plan]), 24);
});
await t("seed: Movilidad y Activación ya no están en los planes", async () => {
  assert.equal(await cuenta(`select count(*) n from bloques where nombre ~* '^(movilidad|activaci)'`), 0);
  assert.equal(await cuenta(`select count(*) n from bloque_ejercicios`), 193);
});
await t("seed: cada sesión empieza en el orden 1 (sin huecos)", async () => {
  assert.equal(await cuenta(`select count(*) n from sesiones s where not exists (select 1 from bloques b where b.sesion_id=s.id and b.orden=1)`), 0);
});
await t("seed: super series con grupo y la nota limpia", async () => {
  assert.equal(await cuenta(`select count(*) n from bloque_ejercicios where nota ~* 'super serie'`), 0);
  assert.ok(await cuenta(`select count(*) n from bloque_ejercicios where grupo is not null`) > 100);
  assert.equal(await cuenta(`select count(*) n from bloque_ejercicios where nota like 'f,,,x%'`), 0);
  assert.equal(await cuenta(`select count(*) n from bloque_ejercicios where grupo is not null and grupo !~ '^[A-Z]$'`), 0);
});
await t("seed: 'Super Serie 1' y '2' de un bloque son los grupos A y B", async () => {
  const filas = (await db.query(
    `select distinct be.grupo from bloque_ejercicios be join bloques b on b.id=be.bloque_id join sesiones s on s.id=b.sesion_id
     where s.plan_id=$1 and s.semana=1 and s.estimulo=4 and be.grupo is not null order by 1`, [plan])).rows;
  assert.ok(filas.length >= 1);
  assert.equal(filas[0].grupo, "A");
});
await t("migración de super series: lógica sobre notas sueltas", async () => {
  const sql = fs.readFileSync(path.join(RAIZ, "migrations/20261109120000_super_series_y_plan_libre.sql"), "utf8");
  const update = sql.match(/with candidatos as \([\s\S]*?where be\.id = c\.id;/)[0];
  const b = (await db.query(`select b.id as bid, (select id from ejercicios where gym_id=$2 limit 1) as eid from bloques b join sesiones s on s.id=b.sesion_id where s.plan_id=$1 limit 1`, [plan, gym])).rows[0];
  const nuevo = (await db.query(`insert into bloques(sesion_id, orden, nombre) select id, 90, 'Prueba super series' from sesiones where plan_id=$1 limit 1 returning id`, [plan])).rows[0].id;
  const ins = async (orden, nota) => (await db.query(`insert into bloque_ejercicios(bloque_id, orden, ejercicio_id, nota) values ($1,$2,$3,$4) returning id`, [nuevo, orden, b.eid, nota])).rows[0].id;
  const ids = [await ins(1, "Super Serie 1"), await ins(2, "Super Serie 1"), await ins(3, "Super Serie 2"), await ins(4, "Con la barra baja"), await ins(5, "x · Super Serie 3"), await ins(6, "f,,,x,,xtþþþ,,xx,x,x,,,x,,x,,,,zx,,,,x-rt$$ · Super Serie 3")];
  await db.exec(update);
  const r = (await db.query(`select orden, grupo, nota from bloque_ejercicios where bloque_id=$1 order by orden`, [nuevo])).rows;
  assert.deepEqual(r.map((x) => x.grupo), ["A", "A", "B", null, "C", "C"]);
  assert.deepEqual(r.map((x) => x.nota), [null, null, null, "Con la barra baja", "x", null]);
  await db.query(`delete from bloques where id=$1`, [nuevo]);
  void ids;
});
await t("grupo: solo una letra mayúscula", async () => {
  const { eid } = (await db.query(`select id as eid from ejercicios limit 1`)).rows[0];
  const bl = (await db.query(`select id from bloques limit 1`)).rows[0].id;
  await falla(db.query(`insert into bloque_ejercicios(bloque_id, orden, ejercicio_id, grupo) values ($1,99,$2,'AB')`, [bl, eid]), /grupo_letra/);
  await falla(db.query(`insert into bloque_ejercicios(bloque_id, orden, ejercicio_id, grupo) values ($1,99,$2,'a')`, [bl, eid]), /grupo_letra/);
});

// ================================================================ RLS básico
await db.query(`insert into asignaciones(alumno_id, plan_id) values ($1,$2)`, [alumno, plan]);
const s11 = await sesionDe(plan, 1, 1);
const ej11 = await ejerciciosDe(s11);
let registro;
await t("alumno activo registra una serie de su entrenamiento", async () => {
  await como(alumno, async () => {
    registro = (await db.query(`insert into registros_sesion(asignacion_id, sesion_id) select id, $1 from asignaciones where alumno_id=$2 returning id`, [s11, alumno])).rows[0].id;
    await db.query(`insert into registros_series(registro_id,bloque_ejercicio_id,ejercicio_usado_id,n_serie,peso,reps,hecha) values ($1,$2,$3,1,42.5,8,true)`, [registro, ej11[0].id, ej11[0].ejercicio_id]);
  });
  assert.equal(await cuenta(`select count(*) n from registros_series where hecha`), 1);
});
await t("registros_series.hecha: por defecto falso", async () => {
  await como(alumno, () => db.query(`insert into registros_series(registro_id,bloque_ejercicio_id,ejercicio_usado_id,n_serie,peso) values ($1,$2,$3,2,40)`, [registro, ej11[0].id, ej11[0].ejercicio_id]));
  assert.equal(await cuenta(`select count(*) n from registros_series where n_serie=2 and hecha=false`), 1);
});
await t("el alumno no puede crear una serie sin bloque_ejercicio_id ni dejarlo nulo", async () => {
  await como(alumno, () => falla(db.query(`insert into registros_series(registro_id,bloque_ejercicio_id,ejercicio_usado_id,n_serie) values ($1,null,$2,9)`, [registro, ej11[0].ejercicio_id]), /row-level security/));
  await como(alumno, () => falla(db.query(`update registros_series set bloque_ejercicio_id=null where registro_id=$1`, [registro]), /row-level security/));
});
await t("otros alumnos, pendientes y otro gym no ven planes ni series", async () => {
  for (const u of [alumno2, pendiente, externo]) {
    await como(u, async () => {
      assert.equal(await cuenta(`select count(*) n from registros_series`), 0);
      assert.equal(await cuenta(`select count(*) n from planes`), 0);
    });
  }
});
await t("staff: ve su gym; el de otro gym no ve nada", async () => {
  await como(profe, async () => assert.ok(await cuenta(`select count(*) n from planes`) >= 1));
  await como(profe2, async () => {
    for (const tb of ["planes", "ejercicios", "registros_series", "asignaciones", "bloques"]) assert.equal(await cuenta(`select count(*) n from ${tb}`), 0, tb);
  });
});
await t("borrar un bloque_ejercicio con series no falla y la serie conserva peso y ejercicio_usado_id", async () => {
  const be = ej11[0];
  await como(profe, () => db.query(`delete from bloque_ejercicios where id=$1`, [be.id]));
  const r = (await db.query(`select bloque_ejercicio_id, ejercicio_usado_id, peso from registros_series where registro_id=$1 and n_serie=1`, [registro])).rows[0];
  assert.equal(r.bloque_ejercicio_id, null);
  assert.equal(r.ejercicio_usado_id, be.ejercicio_id);
  assert.equal(Number(r.peso), 42.5);
});
await t("las políticas no llaman a los helpers sin envolver en (select ...)", async () => {
  const r = (await db.query(`select policyname, coalesce(qual,'')||' '||coalesce(with_check,'') as e from pg_policies where schemaname='public'`)).rows;
  assert.ok(r.length > 40);
  const crudo = r.filter((p) => /public\.(is_staff|is_alumno_activo|current_rol)\(\)/i.test(p.e.replace(/\( ?SELECT public\.\w+\(\)\)/gi, "")));
  assert.equal(crudo.length, 0, crudo.map((c) => c.policyname).join());
});

// ================================================================ registros_ejercicios
const alumnoRE = await usuario("re@x", gym, "alumno", "activo");
const asigRE = (await db.query(`insert into asignaciones(alumno_id, plan_id) values ($1,$2) returning id`, [alumnoRE, plan])).rows[0].id;
const sRE = await sesionDe(plan, 1, 2);
const ejRE = await ejerciciosDe(sRE);
const otraSesionBe = (await ejerciciosDe(await sesionDe(plan, 1, 3)))[0].id;
let regRE;
await t("registros_ejercicios: el alumno marca y desmarca ejercicios de su sesión", async () => {
  await como(alumnoRE, async () => {
    regRE = (await db.query(`insert into registros_sesion(asignacion_id, sesion_id) values ($1,$2) returning id`, [asigRE, sRE])).rows[0].id;
    await db.query(`insert into registros_ejercicios(registro_id, bloque_ejercicio_id, hecho) values ($1,$2,true)`, [regRE, ejRE[0].id]);
    await db.query(`insert into registros_ejercicios(registro_id, bloque_ejercicio_id, hecho) values ($1,$2,true) on conflict (registro_id, bloque_ejercicio_id) do update set hecho=false`, [regRE, ejRE[0].id]);
  });
  assert.equal(await cuenta(`select count(*) n from registros_ejercicios where registro_id=$1 and hecho=false`, [regRE]), 1);
});
await t("registros_ejercicios: no se marca un ejercicio de otra sesión ni lo hace otro alumno", async () => {
  await como(alumnoRE, () => falla(db.query(`insert into registros_ejercicios(registro_id, bloque_ejercicio_id) values ($1,$2)`, [regRE, otraSesionBe]), /row-level security/));
  for (const u of [alumno2, pendiente, externo]) {
    await como(u, async () => assert.equal(await cuenta(`select count(*) n from registros_ejercicios`), 0));
    await como(u, () => falla(db.query(`insert into registros_ejercicios(registro_id, bloque_ejercicio_id) values ($1,$2)`, [regRE, ejRE[1].id]), /row-level security/));
  }
});
await t("registros_ejercicios: el staff del gym lee, el de otro gym no; el alumno no borra", async () => {
  await como(profe, async () => assert.equal(await cuenta(`select count(*) n from registros_ejercicios where registro_id=$1`, [regRE]), 1));
  await como(profe2, async () => assert.equal(await cuenta(`select count(*) n from registros_ejercicios`), 0));
  await como(alumnoRE, async () => assert.equal((await db.query(`delete from registros_ejercicios where registro_id=$1 returning id`, [regRE])).rows.length, 0));
});

// ================================================================ personalizar_plan
await t("personalizar_plan: errores claros", async () => {
  const otro = (await db.query(`insert into planes(gym_id,nombre,tipo) values ($1,'Otro plan','x') returning id`, [gym])).rows[0].id;
  await como(profe, () => falla(db.query(`select personalizar_plan($1,$2)`, [alumno, otro]), /El alumno no tiene asignado ese plan/));
  await como(profe, () => falla(db.query(`select personalizar_plan($1,$2)`, [alumno2, plan]), /asignación activa/));
  await como(alumno, () => falla(db.query(`select personalizar_plan($1,$2)`, [alumno, plan]), /Solo el staff/));
});
await t("personalizar_plan: copia el grupo, repunta la asignación y conserva el historial", async () => {
  await db.query(`update bloque_ejercicios set grupo='B' where id=$1`, [ej11[1].id]);
  await db.query(`insert into registros_ejercicios(registro_id, bloque_ejercicio_id) values ($1,$2)`, [registro, ej11[1].id]);
  const nuevo = (await como(profe, () => db.query(`select personalizar_plan($1,$2) as id`, [alumno, plan]))).rows[0].id;
  assert.equal((await db.query(`select plan_id from asignaciones where alumno_id=$1 and estado='activa'`, [alumno])).rows[0].plan_id, nuevo);
  assert.equal((await db.query(`select s.plan_id from registros_sesion r join sesiones s on s.id=r.sesion_id where r.id=$1`, [registro])).rows[0].plan_id, nuevo);
  const nuevosEj = await ejerciciosDe(await sesionDe(nuevo, 1, 1));
  const originales = await ejerciciosDe(s11);
  assert.ok(originales.some((x) => x.grupo === "B"));
  assert.equal(nuevosEj.filter((x) => x.grupo).length, originales.filter((x) => x.grupo).length);
  assert.ok(nuevosEj.some((x) => x.grupo === "B"));
  // la marca de "hecho" siguió al ejercicio clonado
  assert.equal(await cuenta(`select count(*) n from registros_ejercicios re join bloque_ejercicios be on be.id=re.bloque_ejercicio_id join bloques b on b.id=be.bloque_id join sesiones s on s.id=b.sesion_id where re.registro_id=$1 and s.plan_id=$2`, [registro, nuevo]), 1);
  await como(profe, () => falla(db.query(`select personalizar_plan($1,$2)`, [alumno, nuevo]), /ya es personalizado/));
});

// ================================================================ completar_sesion: plan libre
const libre = await usuario("libre@x", gym, "alumno", "activo");
const asigLibre = (await db.query(`insert into asignaciones(alumno_id, plan_id) values ($1,$2) returning id`, [libre, plan])).rows[0].id;
const sesLibre = {};
for (const w of [1, 2, 3, 4]) for (const e of [1, 2, 3, 4, 5, 6]) sesLibre[`${w}${e}`] = await sesionDe(plan, w, e);
const completar = (uid, asig, sesion) => como(uid, () => db.query(`select completar_sesion($1,$2) as f`, [asig, sesion]));
const estadoAsig = async (id) => (await db.query(`select semana_actual w, estimulo_actual e, estado from asignaciones where id=$1`, [id])).rows[0];

await t("completar_sesion: S1·E1 hecho, el sugerido pasa a S1·E2", async () => {
  assert.equal((await completar(libre, asigLibre, sesLibre["11"])).rows[0].f, false);
  assert.deepEqual(await estadoAsig(asigLibre), { w: 1, e: 2, estado: "activa" });
  assert.equal(await cuenta(`select count(*) n from registros_sesion where asignacion_id=$1 and completada`, [asigLibre]), 1);
});
await t("completar_sesion: se puede hacer uno salteado y el sugerido sigue siendo el primer pendiente", async () => {
  await completar(libre, asigLibre, sesLibre["14"]);
  assert.deepEqual(await estadoAsig(asigLibre), { w: 1, e: 2, estado: "activa" });
  await completar(libre, asigLibre, sesLibre["22"]); // incluso de otra semana
  assert.deepEqual(await estadoAsig(asigLibre), { w: 1, e: 2, estado: "activa" });
});
await t("completar_sesion: al completar el sugerido salta al siguiente pendiente (saltea los hechos)", async () => {
  await completar(libre, asigLibre, sesLibre["12"]);
  assert.deepEqual(await estadoAsig(asigLibre), { w: 1, e: 3, estado: "activa" });
  await completar(libre, asigLibre, sesLibre["13"]);
  assert.deepEqual(await estadoAsig(asigLibre), { w: 1, e: 5, estado: "activa" }); // el 14 ya estaba hecho
  await completar(libre, asigLibre, sesLibre["15"]);
  await completar(libre, asigLibre, sesLibre["16"]);
  assert.deepEqual(await estadoAsig(asigLibre), { w: 2, e: 1, estado: "activa" }); // pasa de semana
});
await t("completar_sesion: no se repite ni se usa la asignación de otro ni sesiones de otro plan", async () => {
  await falla(completar(libre, asigLibre, sesLibre["11"]), /ya está hecho/);
  await falla(completar(alumno2, asigLibre, sesLibre["23"]), /La asignación no existe/);
  const otroPlan = (await db.query(`insert into planes(gym_id,nombre,tipo) values ($1,'Ajeno','x') returning id`, [gym])).rows[0].id;
  await falla(completar(libre, asigLibre, await sesionDe(otroPlan, 1, 1)), /no es de tu plan/);
});
await t("completar_sesion: pendientes y anon no pueden", async () => {
  await falla(completar(pendiente, asigLibre, sesLibre["23"]), /No tenés permiso/);
});
await t("completar_sesion: con las 24 completas la asignación se finaliza", async () => {
  const hechas = new Set(["11", "14", "22", "12", "13", "15", "16"]);
  const restantes = Object.keys(sesLibre).filter((k) => !hechas.has(k)).sort();
  const ultima = restantes.pop();
  for (const k of restantes) assert.equal((await completar(libre, asigLibre, sesLibre[k])).rows[0].f, false);
  assert.equal((await completar(libre, asigLibre, sesLibre[ultima])).rows[0].f, true);
  const a = (await db.query(`select estado, fecha_fin from asignaciones where id=$1`, [asigLibre])).rows[0];
  assert.equal(a.estado, "finalizada");
  assert.ok(a.fecha_fin);
  assert.equal(await cuenta(`select count(*) n from registros_sesion where asignacion_id=$1 and completada`, [asigLibre]), 24);
  await falla(completar(libre, asigLibre, sesLibre[ultima]), /ya está finalizado/);
});

// ================================================================ pedir_proximo_ciclo
const pide = await usuario("pide@x", gym, "alumno", "activo");
const asigPide = (await db.query(`insert into asignaciones(alumno_id, plan_id) values ($1,$2) returning id`, [pide, plan])).rows[0].id;
const pedir = (uid, asig, tipo, nota) => como(uid, () => db.query(`select pedir_proximo_ciclo($1,$2,$3) as id`, [asig, tipo, nota]));
await t("pedir_proximo_ciclo: con pendientes finaliza la asignación y crea la solicitud", async () => {
  await completar(pide, asigPide, await sesionDe(plan, 1, 1));
  const id = (await pedir(pide, asigPide, "Volumen", "Quiero más")).rows[0].id;
  const a = (await db.query(`select estado, fecha_fin from asignaciones where id=$1`, [asigPide])).rows[0];
  assert.equal(a.estado, "finalizada");
  assert.ok(a.fecha_fin);
  const s = (await db.query(`select alumno_id, tipo_solicitado, nota, estado from solicitudes_ciclo where id=$1`, [id])).rows[0];
  assert.deepEqual([s.alumno_id, s.tipo_solicitado, s.nota, s.estado], [pide, "Volumen", "Quiero más", "pendiente"]);
  assert.equal(await cuenta(`select count(*) n from registros_sesion where asignacion_id=$1 and completada`, [asigPide]), 1);
});
await t("pedir_proximo_ciclo: pedirlo dos veces no duplica la solicitud", async () => {
  const otra = (await pedir(pide, asigPide, "Definición", null)).rows[0].id;
  assert.equal(await cuenta(`select count(*) n from solicitudes_ciclo where asignacion_id=$1`, [asigPide]), 1);
  assert.ok(otra);
});
await t("pedir_proximo_ciclo: validaciones y permisos", async () => {
  await pedir(alumno2, asigPide, "Volumen", null).then(() => assert.fail("debió fallar"), (e) => assert.match(e.message, /La asignación no existe/));
  const x = await usuario("x@x", gym, "alumno", "activo");
  const asigX = (await db.query(`insert into asignaciones(alumno_id, plan_id) values ($1,$2) returning id`, [x, plan])).rows[0].id;
  await pedir(x, asigX, "  ", null).then(() => assert.fail("debió fallar"), (e) => assert.match(e.message, /Elegí qué ciclo/));
  await pedir(pendiente, asigX, "Volumen", null).then(() => assert.fail("debió fallar"), (e) => assert.match(e.message, /No tenés permiso/));
  assert.equal((await db.query(`select estado from asignaciones where id=$1`, [asigX])).rows[0].estado, "activa");
});
await t("pedir_proximo_ciclo: tras completar las 24 también se puede pedir", async () => {
  await pedir(libre, asigLibre, "Definición", "Terminé").then((r) => assert.ok(r.rows[0].id));
  assert.equal(await cuenta(`select count(*) n from solicitudes_ciclo where asignacion_id=$1`, [asigLibre]), 1);
});

// ================================================================ funciones de staff
const alumnoAsignar = await usuario("asignar@x", gym, "alumno", "activo");
await t("asignar_plan: crea S1·E1 activa y cambiar de plan finaliza la anterior", async () => {
  const id = (await como(profe, () => db.query(`select asignar_plan($1,$2) as id`, [alumnoAsignar, plan]))).rows[0].id;
  assert.deepEqual(await estadoAsig(id), { w: 1, e: 1, estado: "activa" });
  const otro = (await db.query(`insert into planes(gym_id,nombre,tipo) values ($1,'Definicion','Definición') returning id`, [gym])).rows[0].id;
  await como(profe, () => db.query(`select asignar_plan($1,$2)`, [alumnoAsignar, otro]));
  assert.equal(await cuenta(`select count(*) n from asignaciones where alumno_id=$1 and estado='activa'`, [alumnoAsignar]), 1);
  assert.equal(await cuenta(`select count(*) n from asignaciones where alumno_id=$1 and estado='finalizada' and fecha_fin is not null`, [alumnoAsignar]), 1);
});
await t("asignar_plan: no staff, otro gym, alumno ajeno", async () => {
  await como(alumno, () => falla(db.query(`select asignar_plan($1,$2)`, [alumnoAsignar, plan]), /Solo el staff/));
  await como(profe2, () => falla(db.query(`select asignar_plan($1,$2)`, [alumnoAsignar, plan]), /El plan no existe en tu gimnasio/));
  await como(profe, () => falla(db.query(`select asignar_plan($1,$2)`, [externo, plan]), /El alumno no existe en tu gimnasio/));
});
await t("atender_solicitud: asigna, marca atendida por el usuario y no se repite", async () => {
  const sol = (await db.query(`select id from solicitudes_ciclo where asignacion_id=$1`, [asigPide])).rows[0].id;
  await como(profe, () => db.query(`select atender_solicitud($1,$2)`, [sol, plan]));
  const s = (await db.query(`select estado, atendida_por from solicitudes_ciclo where id=$1`, [sol])).rows[0];
  assert.deepEqual([s.estado, s.atendida_por], ["atendida", profe]);
  assert.equal(await cuenta(`select count(*) n from asignaciones where alumno_id=$1 and estado='activa'`, [pide]), 1);
  await como(profe, () => falla(db.query(`select atender_solicitud($1,$2)`, [sol, plan]), /ya fue atendida/));
  await como(profe2, () => falla(db.query(`select atender_solicitud($1,$2)`, [sol, plan]), /La solicitud no existe/));
});
let copia;
await t("duplicar_plan: clon completo como plantilla, con los grupos", async () => {
  copia = (await como(profe, () => db.query(`select duplicar_plan($1,'Definición 2','Definición',null) as id`, [plan]))).rows[0].id;
  const p = (await db.query(`select alumno_id, origen_id, nombre from planes where id=$1`, [copia])).rows[0];
  assert.deepEqual([p.alumno_id, p.origen_id, p.nombre], [null, null, "Definición 2"]);
  assert.equal(await cuenta(`select count(*) n from sesiones where plan_id=$1`, [copia]), 24);
  const q = (extra) => `select count(*) n from bloque_ejercicios be join bloques b on b.id=be.bloque_id join sesiones s on s.id=b.sesion_id where s.plan_id=$1 ${extra}`;
  assert.equal(await cuenta(q(""), [copia]), await cuenta(q(""), [plan]));
  assert.equal(await cuenta(q("and be.grupo is not null"), [copia]), await cuenta(q("and be.grupo is not null"), [plan]));
  await como(profe, () => falla(db.query(`select duplicar_plan($1,'  ','x',null)`, [plan]), /nombre y tipo/));
  await como(profe2, () => falla(db.query(`select duplicar_plan($1,'a','b',null)`, [plan]), /no existe en tu gimnasio/));
});
await t("copiar_semana: reemplaza la destino con una copia de la origen, con los grupos", async () => {
  const cant = (w, extra = "") => cuenta(`select count(*) n from bloque_ejercicios be join bloques b on b.id=be.bloque_id join sesiones s on s.id=b.sesion_id where s.plan_id=$1 and s.semana=$2 ${extra}`, [copia, w]);
  await db.query(`insert into bloques(sesion_id, orden, nombre) select id, 99, 'Sobrante' from sesiones where plan_id=$1 and semana=2 and estimulo=1`, [copia]);
  const n = (await como(profe, () => db.query(`select copiar_semana($1,1,2) as n`, [copia]))).rows[0].n;
  assert.ok(n > 0);
  assert.equal(await cuenta(`select count(*) n from bloques b join sesiones s on s.id=b.sesion_id where s.plan_id=$1 and b.nombre='Sobrante'`, [copia]), 0);
  assert.equal(await cant(2), await cant(1));
  assert.equal(await cant(2, "and be.grupo is not null"), await cant(1, "and be.grupo is not null"));
  await como(profe, () => falla(db.query(`select copiar_semana($1,2,2)`, [copia]), /dos semanas distintas/));
  await como(profe2, () => falla(db.query(`select copiar_semana($1,1,2)`, [copia]), /no existe en tu gimnasio/));
});
await t("las funciones internas no las puede ejecutar un usuario", async () => {
  await como(profe, () => falla(db.query(`select _clonar_bloques($1,$1)`, [s11]), /permission denied/));
});

console.log(`\n${ok} ok, ${mal} fallaron`);
process.exit(mal ? 1 : 0);
