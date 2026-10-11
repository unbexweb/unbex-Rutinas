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
