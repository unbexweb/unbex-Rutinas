# Unbex Rutinas — Plan de construcción con Claude Code

Cada fase es un prompt para pegar en Claude Code (VS Code). Hacé una fase por vez, revisá, commiteá y recién ahí pasá a la siguiente.

**Antes de empezar**
1. Creá el repo vacío (ej. `unbex-rutinas`) y clonalo.
2. Copiá `SPEC-unbex-rutinas.md` a `docs/SPEC.md`.
3. Copiá la planilla de ejemplo (`Juan_Dinis_plani_muscu.pdf`) a `docs/ejemplo-planilla.pdf` para usarla en el seed.
4. Creá el proyecto en Supabase (free) y tené a mano URL, anon key y service role key.

---

## CLAUDE.md (crealo en la raíz del repo antes de la Fase 0)

```markdown
# Unbex Rutinas

App web (PWA mobile-first) de rutinas de musculación para Unbex. La especificación completa está en docs/SPEC.md: es la fuente de verdad. Ante cualquier duda de alcance, leela antes de inventar.

## Stack
- Next.js 15 (App Router) + React 19 + TypeScript estricto
- Supabase: Auth + Postgres + RLS, cliente con @supabase/ssr
- Deploy en Vercel

## Reglas obligatorias
- Gestor de paquetes: SIEMPRE pnpm. Nunca npm install ni yarn.
- Versiones exactas en package.json (sin ^ ni ~). En CI: pnpm install --frozen-lockfile.
- pnpm-workspace.yaml con minimumReleaseAge: 1440 y blockExoticSubdeps: true.
- Colores y fuentes SOLO por variables CSS definidas en app/globals.css. Nunca hardcodear hex ni nombres de fuente en componentes.
  - --color-violeta: #4B2556
  - --color-rosa: #FDE3D8
  - Fuente: Montserrat (next/font)
- Todo el copy de la UI en español rioplatense con voseo ("Empezá", "Terminaste").
- Toda tabla con datos de un gimnasio filtra por gym_id vía RLS. Nunca confiar en filtros del cliente.
- La service role key solo se usa en código de servidor (Server Actions / Route Handlers), nunca en el cliente.
- Mobile-first: la UI del alumno se diseña para celular, botones grandes (mínimo 48px de alto), inputs numéricos con inputMode="decimal".

## Estructura
- app/(auth)/        login, registro
- app/(alumno)/      vistas del alumno
- app/(staff)/       vistas de profe y admin
- lib/supabase/      clientes server/browser/middleware
- supabase/migrations/  SQL versionado
- types/database.ts  tipos generados de Supabase
```

---

## Fase 0 — Setup del proyecto

```
Leé CLAUDE.md y docs/SPEC.md completos antes de empezar.

Armá la base del proyecto:

1. Inicializá Next.js 15 con App Router, TypeScript estricto, ESLint y sin Tailwind (usamos CSS Modules + variables CSS globales). Usá pnpm.
2. Fijá versiones exactas en package.json y creá pnpm-workspace.yaml con minimumReleaseAge: 1440 y blockExoticSubdeps: true.
3. Instalá @supabase/supabase-js y @supabase/ssr.
4. Creá lib/supabase/server.ts, lib/supabase/client.ts y lib/supabase/middleware.ts siguiendo el patrón oficial de @supabase/ssr para App Router (cookies con getAll/setAll).
5. Creá middleware.ts que refresque la sesión en cada request.
6. app/globals.css con las variables de color y tipografía de CLAUDE.md, reset básico y estilos base mobile-first. Cargá Montserrat con next/font y exponela como variable CSS.
7. .env.example con NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY. Agregá .env.local al .gitignore.
8. Creá las carpetas de route groups (auth), (alumno), (staff) con un page.tsx placeholder cada una.
9. Instalá la CLI de Supabase como devDependency y dejá un script "db:types" que genere types/database.ts.

No construyas pantallas todavía. Al terminar, listame los archivos creados y los comandos para levantar el proyecto.
```

---

## Fase 1 — Base de datos, RLS y seed

```
Leé docs/SPEC.md, sección 8 (Modelo de datos) y sección 3 (Roles).

Creá las migraciones SQL en supabase/migrations/:

1. Enums: rol (admin, profe, alumno), estado_usuario (pendiente, activo, inactivo), estado_asignacion (activa, finalizada), estado_solicitud (pendiente, atendida).
2. Todas las tablas de la sección 8 con sus FK, NOT NULL donde corresponda, created_at/updated_at e índices en todas las FK.
   - profiles.id referencia auth.users(id) on delete cascade.
   - dni y email únicos.
   - sesiones: CHECK semana between 1 and 4, CHECK estimulo between 1 and 6, UNIQUE(plan_id, semana, estimulo).
   - asignaciones: índice único parcial para una sola asignación activa por alumno.
   - planes.tipo como text (no enum), para poder sumar tipos sin migración.
3. Trigger: al insertar un plan, crear automáticamente sus 24 sesiones.
4. Trigger: al crear un usuario en auth.users, crear su profile leyendo nombre, apellido, dni y gym_id de raw_user_meta_data, con rol alumno y estado pendiente.
5. Función SQL security definer que, dado un DNI, devuelva el email asociado (para login con DNI). Que no exponga nada más.
6. Funciones helper para RLS: current_gym_id(), current_rol(), is_staff() (admin o profe). Security definer, search_path fijo.
7. RLS habilitado en TODAS las tablas, con políticas:
   - Todo restringido al gym del usuario.
   - Alumno: lee su profile, su ficha (lee y edita), sus asignaciones, los planes/sesiones/bloques/ejercicios de sus asignaciones, y crea/lee sus registros y solicitudes.
   - Profe y admin (is_staff): lectura y escritura sobre todo lo de su gym.
   - Solo admin: puede cambiar el rol de un profile.
   - Un alumno pendiente o inactivo no ve planes.
8. Función para personalizar un plan: clona plan + sesiones + bloques + bloque_ejercicios con alumno_id y origen_id, y repunta la asignación activa del alumno. Ejecutable solo por staff.
9. Seed (supabase/seed.sql): un gym "Unbex", la biblioteca de ejercicios y un plan "Volumen" nivel General cargado completo a partir de docs/ejemplo-planilla.pdf (las 4 semanas x 6 estímulos, con sus bloques: Movilidad, Activación, Bloque 1, Bloque 2, Bloque 3 y Opcional cuando exista). Series y reps tal cual figuran ("3x8/10", "3x6/6", "3x20\""). Dejá video_url vacío.

Al terminar, explicame cómo aplicar las migraciones y el seed, y generá types/database.ts. Escribí también un archivo docs/RLS.md con una tabla de qué puede hacer cada rol en cada tabla, para revisarlo.
```

---

## Fase 2 — Autenticación y roles
*(te la armo cuando cierres la Fase 1)*

## Fase 3 — Vistas del alumno
## Fase 4 — Vistas de profe y admin (incluye el editor de planes)
## Fase 5 — PWA, pruebas en celular y deploy
