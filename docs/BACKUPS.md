# Backups de la base de datos

> **Estado:** el workflow está escrito pero **todavía no se probó contra producción**. Antes de confiar en él: cargá los dos secrets (paso 2), corrélo a mano una vez (paso 3) y hacé un simulacro de restauración (sección "Restaurar").

## Qué hace

El workflow [`.github/workflows/backup.yml`](../.github/workflows/backup.yml) corre **todos los días a las 4:00 AM de Argentina** y también a mano desde GitHub. Cada vez:

1. Con la CLI de Supabase hace tres dumps de la base: `roles.sql`, `schema.sql` y `data.sql`. El de datos incluye la tabla de usuarios (`auth.users`, con las contraseñas ya hasheadas) y todo lo de `public`.
2. Comprueba que los dumps no estén vacíos y que tengan los perfiles y los usuarios. Si algo no cierra, falla.
3. Los junta en un `.tar.gz` y lo encripta con `gpg` (AES-256) usando tu frase secreta.
4. Sube **solo el archivo encriptado** como *artifact* del workflow, con retención de **30 días**. Los `.sql` en claro nunca salen del servidor de GitHub.

Si cualquier paso falla, el workflow queda en **rojo** y GitHub te manda un mail (ver "Avisos").

**Qué NO incluye** (hay que rehacerlo a mano si hace falta restaurar):
- La configuración del proyecto de Supabase: URL Configuration, SMTP, plantillas de mail, providers de Auth.
- Las variables de entorno de Vercel.
- Archivos de Supabase Storage (la app no usa Storage hoy).

## 1. Dónde saco la cadena de conexión (`SUPABASE_DB_URL`)

Hace falta la del **Session pooler**, no la conexión directa: la directa (`db.<proyecto>.supabase.co`) solo funciona por IPv6 y los servidores de GitHub no tienen IPv6.

1. Entrá a [supabase.com/dashboard](https://supabase.com/dashboard) y abrí el proyecto de Unbex.
2. Arriba, tocá **Connect**.
3. En **Connection string**, elegí **Session pooler** (puerto **5432**).
4. Copiá la cadena. Tiene esta forma:

   ```
   postgresql://postgres.<ref-del-proyecto>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

5. Reemplazá `[YOUR-PASSWORD]` (con los corchetes) por la **contraseña de la base de datos**. Si no la tenés: **Project Settings → Database → Reset database password**. Ojo: cambiarla corta cualquier otra cosa que la use.
6. Si la contraseña tiene caracteres especiales (`@`, `#`, `/`, `:`, `%`, espacios…), la CLI exige que estén codificados (`@` → `%40`, `#` → `%23`, `/` → `%2F`, `:` → `%3A`, `%` → `%25`). Lo más simple es resetearla a una que tenga **solo letras y números** (y larga).

## 2. Cómo cargo los dos secrets en GitHub

1. En el repositorio de GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
2. Creá estos dos:

   | Nombre | Valor |
   | --- | --- |
   | `SUPABASE_DB_URL` | La cadena del paso 1, con la contraseña ya puesta. |
   | `BACKUP_PASSPHRASE` | Una frase secreta larga, que inventás ahora (ver abajo). |

3. Para generar la frase, por ejemplo: `openssl rand -base64 32` (o la que genere tu gestor de contraseñas).

> **Guardá `BACKUP_PASSPHRASE` también en un gestor de contraseñas, afuera de GitHub.** Los secrets de GitHub no se pueden volver a leer. Si la perdés, **todos los backups quedan ilegibles para siempre**. Si algún día la cambiás, los backups viejos se siguen abriendo con la frase vieja: anotá cuál usaste desde cuándo.

## 3. Correrlo a mano y revisar que ande

1. **Actions → Backup diario → Run workflow → Run workflow**.
2. Esperá unos minutos. Tiene que terminar en verde, con todos los pasos tildados.
3. Abajo de la página del run, en **Artifacts**, tiene que aparecer `unbex-backup-AAAA-MM-DD_HH-MM`.
4. Descargalo y probá desencriptarlo (siguiente sección) para confirmar que la frase funciona.

## Avisos si falla

- GitHub manda un mail cuando un workflow **programado** falla. Revisá en **GitHub → Settings → Notifications → Actions** que esté activado ("Send notifications for failed workflows only" alcanza). El mail llega a la cuenta de quien hizo el último cambio en la línea del `cron` del archivo.
- Si el repositorio queda **60 días sin actividad**, GitHub **pausa los workflows programados** y te avisa por mail. Se reactivan desde la pestaña Actions.
- Mirá la pestaña Actions de vez en cuando: un backup en verde de ayer es la mejor señal de que anda.

## Descargar y desencriptar un backup

Necesitás `gpg` (en Windows viene con **Git Bash**; si no, instalá [Gpg4win](https://www.gpg4win.org/)).

1. **Actions →** elegí el run del día que quieras **→ Artifacts →** descargá `unbex-backup-…`. Baja un `.zip` que adentro tiene el archivo `unbex-backup-AAAA-MM-DD_HH-MM.tar.gz.gpg`. Descomprimí el zip.
2. Desencriptá (te pide la frase de `BACKUP_PASSPHRASE`):

   ```bash
   gpg --output backup.tar.gz --decrypt unbex-backup-AAAA-MM-DD_HH-MM.tar.gz.gpg
   ```

3. Extraé los tres archivos:

   ```bash
   tar -xzf backup.tar.gz
   ```

   Quedan `roles.sql`, `schema.sql` y `data.sql`.

Estos archivos tienen **todos los datos de los alumnos** (nombres, DNI, mails, fichas de salud, hashes de contraseñas). Cuando termines, borralos y no los dejes en carpetas compartidas ni en la nube.

## Restaurar en un proyecto de Supabase nuevo

Hace falta tener `psql` (el cliente de PostgreSQL) instalado. Los archivos son los del paso anterior.

**1. Crear el proyecto nuevo.** En Supabase → **New project**, en la misma región (hoy `sa-east-1`). Anotá la contraseña de la base que elijas.

**2. Conseguir su cadena de conexión.** La misma que en la sección 1 (Connect → Session pooler), pero del proyecto **nuevo**. Probá con una variable:

```bash
NUEVA_URL='postgresql://postgres.<ref-nuevo>:<contraseña>@aws-0-<region>.pooler.supabase.com:5432/postgres'
```

**3. Restaurar roles, esquema y datos.** En la carpeta donde extrajiste los archivos:

```bash
# Roles (si algún rol ya existe, psql avisa y sigue: es normal)
psql --dbname "$NUEVA_URL" --file roles.sql

# Esquema y datos en una sola transacción: o entra todo o no entra nada
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NUEVA_URL"
```

`session_replication_role = replica` apaga los triggers durante la carga de datos, para que no se creen perfiles ni sesiones duplicadas.

**4. Verificar.** En el SQL Editor del proyecto nuevo (o con `psql`):

```sql
select count(*) from auth.users;
select count(*) from public.profiles;
select count(*) from public.ejercicios;
select count(*) from public.planes;
select count(*) from public.registros_sesion;
```

Los números tienen que coincidir con los de producción el día del backup.

**5. Reconfigurar lo que el backup no incluye.**
- **Auth → URL Configuration:** Site URL y Redirect URLs (ver `docs/DEPLOY.md`).
- **Auth → SMTP Settings** si usabas un SMTP propio.
- **Vercel → Environment Variables:** cambiar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` por las del proyecto nuevo (Project Settings → API Keys) y volver a hacer el deploy.
- **Tu compu:** `.env.local`, y `pnpm supabase link --project-ref <ref-nuevo>`.
- **GitHub:** actualizar el secret `SUPABASE_DB_URL` para que los backups sigan con el proyecto nuevo.

**6. Marcar las migraciones como ya aplicadas.** El backup trae las tablas, pero no el historial de migraciones. Para que `pnpm supabase db push` no intente aplicarlas de nuevo, con el proyecto ya enlazado:

```bash
pnpm supabase migration repair --status applied \
  20261010120000 20261010120100 20261010120200 20261012120000 \
  20261013120000 20261014120000 20261109120000
```

(Una por cada archivo de `supabase/migrations/`: el número es el principio del nombre. Si se agregaron migraciones nuevas, sumalas a la lista. Podés ver el estado con `pnpm supabase migration list`.)

**7. Probar la app.** Entrá con un usuario real. Los usuarios y sus contraseñas se restauran, pero **las sesiones abiertas se invalidan** (el proyecto nuevo tiene otras claves de firma): cada persona tiene que volver a iniciar sesión.

## Simulacro (recomendado)

Un backup que nunca se restauró no es un backup confiable. Una vez, apenas funcione el workflow, y después cada tanto (por ejemplo cada 3 meses): bajá el último backup, restauralo en un proyecto de Supabase **de prueba** siguiendo los pasos de arriba, verificá los conteos, y borrá el proyecto de prueba y los archivos.

## Notas técnicas

- **Versión de la CLI:** el workflow usa la misma que el proyecto (`2.120.0`). Si actualizás la CLI en `package.json`, actualizá también `SUPABASE_CLI_VERSION` en el workflow.
- **Acciones de GitHub:** se usan `supabase/setup-cli@v1` y `actions/upload-artifact@v4`, fijadas por versión mayor.
- **Los secrets nunca se imprimen:** GitHub los enmascara en los logs, y la cadena de conexión solo se pasa por variable de entorno.
- **Dónde viven los backups:** en GitHub, el mismo proveedor que el código. Están encriptados, así que quien tenga acceso al repositorio no puede leerlos sin la frase. Si querés una segunda copia fuera de GitHub, descargá uno de vez en cuando y guardalo encriptado en otro lado.
- **Consumo:** un backup tarda pocos minutos; entra de sobra en los minutos gratis de GitHub Actions.
