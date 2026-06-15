# Al Día — Contexto del proyecto

App de **control de deudas** personales y compartidas (con la pareja). Pensada para Colombia (COP), uso en PC y celular. Dueño: Luis (GitHub `luisjmj`).

> **Estado (al retomar):** todas las funcionalidades listadas abajo están implementadas, probadas y desplegadas. Último commit pusheado: `c9ac784`. Lo siguiente del roadmap es la **PWA**.

## Stack
- **React + Vite + TypeScript**, **Tailwind CSS** (modo oscuro por defecto + claro).
- **Recharts** (gráficas), **lucide-react** (íconos), **react-router-dom**.
- **Supabase** (Auth + Postgres + RLS) como backend.
- Carpeta del proyecto: `al-dia/` (dentro de "Postman Si"). La carpeta padre tiene espacio → en `.claude/launch.json` usar `cwd` (no `--prefix`). Dev server en puerto 5174.

## Despliegue
- **Cloudflare Pages/Workers**: https://al-dia.medinajluisj.workers.dev (auto-deploy desde GitHub `github.com/luisjmj/al-dia`, rama `main`; cada `git push` redespliega).
- SPA configurada con `wrangler.jsonc` (`assets.not_found_handling: single-page-application`). NO usar `_redirects` (Cloudflare Workers lo rechaza por bucle).
- Variables en Cloudflare (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Netlify quedó abandonado (se acabaron los créditos de build); el `netlify.toml` sigue en el repo pero ya no se usa.
- **Importante**: antes de hacer push, verificar con `npm run build` (corre `tsc -b`, más estricto que `tsc --noEmit`).

## Supabase
- Proyecto ref: `tcowdwbepwrvossknyem`. URL: `https://tcowdwbepwrvossknyem.supabase.co`.
- Email confirmation DESACTIVADO (dev). Cuenta de prueba: `luis@aldia.test` / `prueba123`.
- Esquema canónico en `supabase/schema.sql` (idempotente). Migraciones aplicadas (todas corridas): 001 (debts.variable), 002 (payments.type), 003 (debts.principal), 004 (debts.url), 005 (tabla categories). La columna `payments.type` acepta `"cuota" | "abono" | "skipped"`. Las 8 categorías predeterminadas ya están sembradas en el hogar; hay una categoría extra de prueba **"Mascotas"** (slug `mascotas`) que el usuario puede borrar desde el admin si quiere.
- Tablas: `profiles`, `households`, `household_members`, `debts`, `payments`, `categories`. RLS por hogar; deuda visible si eres dueño o es compartida en tu hogar. Hogar compartido vía `invite_code` + RPC `join_household`. Trigger crea perfil+hogar al registrarse.
- Para verificar datos con RLS se usa el token de sesión del navegador (la anon key sola devuelve `[]`).

## Arquitectura
- Modo dual por `lib/supabase.ts` (`hasSupabase`): con llaves → nube (`storeSupabase.tsx` + `auth.tsx` + `pages/Login.tsx`); sin llaves → local (`store.tsx`, localStorage, seed en `lib/seed.ts`). Ambos comparten el mismo `Ctx`/interfaz `Store`, así las páginas no cambian.
- Capa de datos: `lib/repo.ts` (mapea snake_case↔camelCase; envía columnas opcionales solo si existen, por seguridad ante migraciones pendientes).
- Pantallas: `pages/Dashboard, Debts, Payments, Stats`. Componentes clave: `DebtForm`, `PaymentRow`, `InstallmentDetail`, `ArchivedDebts`, `Layout`, `ui`.

## Funcionalidades
- **Deudas**: tipo recurrente / a cuotas / pago único; frecuencia; categoría; día de pago; interés **E.A.** (efectivo anual); monto **variable** (servicios, se registra el real al pagar); compartida; URL "ir a pagar" (ícono externo solo si hay URL); nota.
- **Créditos a cuotas**: se ingresa el **valor total** y la app calcula la cuota (sistema francés). Detalle con tabla de amortización (interés/capital/saldo) y **abono a capital** en dos modalidades: *reducir nº de cuotas* o *reducir valor de la cuota*, con preview y Aceptar/Cancelar. Lógica en `lib/amortization.ts`. Bug corregido: el preview de "ahorras en interés" usaba fórmula incorrecta (`remaining * cuota − saldo`) que se inflaba por redondeo; ahora usa simulación `payoff`. `debt.principal` = total original (fuente de verdad).
- **Pagos**: toggle mensual por deuda; navegación entre meses; registra quién pagó. Botón **"No se paga este mes"** (ícono `MinusCircle`) en cada fila pendiente: marca la deuda como skipped (`Payment.type = "skipped"`, amount=0), la excluye de totales y del dashboard, reversible con "deshacer". En meses pasados, botón **"Generar pagos para este mes"** para incluir deudas que ya existían al momento actual pero no aplican ese mes pasado (excluye deudas cuyo `startDate` es posterior a hoy). Al crear una deuda con inicio pasado, pregunta cuántas cuotas ya pagaste y las registra (backfill).
- **Estadísticas**: gasto mes a mes, **proyección del próximo mes** (comprometido + colchón variable del histórico), por categoría, aporte por persona.
- **Archivadas**: menú en Deudas para restaurar o eliminar (borrado real, pagos en cascada).
- **Admin** (`/admin`, ícono de ajustes en el header): gestionar categorías (agregar/editar nombre, color, ícono / eliminar con confirmación). VERIFICADO funcionando y persistiendo en Supabase. Categorías guardadas por hogar en tabla `categories`; las páginas leen `categories` del store (no más constante fija). `CategoryId` ahora es texto libre (slug). Fallback a las 8 predeterminadas si la tabla no existe. Componente: `pages/Admin.tsx`. Acciones en el store: `addCategory/updateCategory/deleteCategory`; repo: `getCategories` (siembra defaults si vacío), `insert/update/deleteCategory`.
- **Diseño**: tags de categoría con fondo sólido + texto oscuro/claro automático (`readableText` en `lib/format.ts`). Deudas con inicio futuro muestran "Programada" (no "Finalizada").

## Pendiente / roadmap
1. **PWA** (instalable + recordatorios push) — siguiente gran paso.
2. Reactivar email confirmation en Supabase.
3. Recordatorios por email.
4. Posible selector de tasa "E.A. / mensual" (el banco a veces da la tasa en otra modalidad).

## Notas
- OneDrive provoca recargas frecuentes del dev server y el screenshot del preview a veces se cuelga; verificar leyendo estilos/estado vía `preview_eval` o consultando la BD.
- Al probar features se crean deudas de prueba; recordar borrarlas (vía API con el token de sesión) para no dejar datos basura.
- Memoria relacionada: ver `MEMORY.md` del usuario (`project-al-dia`).
- Respuestas cortas: no dar explicaciones de más, reducir al mínimo necesario.
