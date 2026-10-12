# Deploy a producción

## Antes del primer deploy (checklist)

Son los pendientes de [`docs/PENDIENTES.md`](PENDIENTES.md). Los marcados con 🔴 no se pueden saltear.

- [ ] 🔴 **Rotar las keys de Supabase.** La service role key legacy está en el historial de GitHub (commit 49faa1e). Ver "Migrar a las keys nuevas" más abajo.
- [ ] 🔴 **Crear tu usuario admin real:** `pnpm tsx --env-file=.env.local scripts/crear-admin.ts tu@email.com 12345678 Nombre Apellido`. Imprime una contraseña temporal; entrá y cambiala desde "¿Olvidaste tu contraseña?".
- [ ] 🔴 **Borrar los usuarios de prueba** (`alumno.prueba@unbex.test`, `admin.prueba@unbex.test`) desde Supabase → Authentication → Users. Al borrar el usuario se borran su perfil, sus asignaciones y sus registros.
- [ ] 🔴 **Configurar un SMTP propio en Supabase** (Authentication → SMTP Settings). Sin eso, la recuperación de contraseña se queda sin mails enseguida.
- [ ] **Cargar el contenido real del plan "Definición"** (hoy es una copia de Volumen).
- [ ] **Reemplazar los íconos provisorios** de la PWA por el logo real (ver lista de archivos en PENDIENTES).
- [ ] *(Opcional)* Pasar la CSP a nonces.

## 1. Crear el proyecto en Vercel

1. Entrá a [vercel.com](https://vercel.com) con la cuenta de Unbex → **Add New… → Project**.
2. **Import Git Repository** y elegí `unbexweb/unbex-Rutinas`. Si no aparece, **Adjust GitHub App Permissions** y dale acceso al repo.
3. Dejá el framework en **Next.js**. Vercel detecta pnpm por el `pnpm-lock.yaml`.
4. Si pide comandos: Install `pnpm install --frozen-lockfile`, Build `pnpm build`.
5. **No hagas Deploy todavía:** primero cargá las variables (paso siguiente).

## 2. Variables de entorno

En el proyecto → **Settings → Environment Variables**, para **Production** (y Preview si querés probar ramas):

| Variable | Valor | Notas |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<tu-proyecto>.supabase.co` | Supabase → Settings → API. Es pública. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la **publishable key** (`sb_publishable_…`) | Es pública. El nombre de la variable no cambia. |
| `SUPABASE_SERVICE_ROLE_KEY` | la **secret key** (`sb_secret_…`) | **Secreta.** Solo servidor. Marcala como Sensitive. |
| `GYM_SLUG` | `unbex` | Gimnasio al que se asocian los registros nuevos. |

Después hacé **Deploy**. Los headers de seguridad (CSP, HSTS, etc.) vienen de `next.config.ts`; HSTS y `upgrade-insecure-requests` se activan solos en Vercel.

## 3. Dominio `app.unbex.com.ar`

1. Proyecto → **Settings → Domains → Add** → `app.unbex.com.ar`.
2. Vercel te muestra un registro **CNAME** para `app` (algo como `cname.vercel-dns.com`). Cargalo en el DNS de `unbex.com.ar` (donde esté administrado el dominio).
3. Esperá a que Vercel muestre el dominio como válido; emite el certificado HTTPS solo (puede tardar unos minutos).
4. Dejá `app.unbex.com.ar` como dominio principal.

## 4. Supabase: URLs de autenticación

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://app.unbex.com.ar`
- **Redirect URLs** (agregar):
  - `https://app.unbex.com.ar/auth/callback`
  - `http://localhost:3000/auth/callback` (para seguir probando en tu compu)

Sin esto, el link del mail de "recuperar contraseña" no vuelve a la app.

Además, en **Authentication → Providers → Email** decidí si exigís confirmar el mail al registrarse. Con confirmación activada, el alumno ve "revisá tu mail" en vez de pasar directo a "pendiente de aprobación".

## 5. Migrar a las keys nuevas de Supabase

1. Supabase → **Settings → API Keys**. Creá la **publishable key** y la **secret key** si todavía no existen.
2. Actualizá `.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY` ← publishable, `SUPABASE_SERVICE_ROLE_KEY` ← secret) y las variables de Vercel.
3. Probá en local: login, registro, alta de alumno desde el panel (usa la secret key) y recuperar contraseña.
4. Recién ahí, en la pestaña **Legacy API Keys**, **deshabilitá las JWT legacy keys** (anon y service_role). Eso invalida la key que quedó expuesta en GitHub.
5. Redeployá en Vercel.

## 6. Después del deploy: verificación rápida

- [ ] `https://app.unbex.com.ar` carga y redirige a `/login`.
- [ ] Entrás con tu admin y ves el panel.
- [ ] Creás un alumno, le asignás un plan y entrás con él desde un celular.
- [ ] Hacés un entrenamiento completo y se guarda.
- [ ] "¿Olvidaste tu contraseña?" manda el mail y el link vuelve a la app.
- [ ] En Chrome de Android aparece "Instalar"; en iPhone, el aviso con las instrucciones de "Agregar a inicio".
- [ ] En DevTools → Application: el manifest se lee, el service worker está activo y no hay errores de CSP en la consola.

## Notas

- Las migraciones de la base se aplican a mano con `pnpm supabase db push` (el proyecto ya está enlazado). Vercel no las corre.
- El service worker (`public/sw.js`) solo cachea archivos estáticos y la página `/offline`. Si cambiás su lógica, subí el número de `CACHE` para que los celulares descarten el caché viejo.
- El plan free de Supabase pausa los proyectos sin actividad durante 7 días: si el gimnasio cierra una temporada, entrá al panel de Supabase para reactivarlo.
