-- =====================================================================
--  Migración 008 · Cron diario que dispara la Edge Function notify-due
--  Corre todos los días a las 17:00 UTC = 12:00 PM Colombia.
--  Requiere las extensiones pg_cron y pg_net (Supabase → Database → Extensions).
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Guarda el service_role key en Vault (una sola vez). Reemplaza el valor.
-- Si ya existe, primero: select vault.update_secret((select id from vault.secrets where name='service_role_key'), 'NUEVO_VALOR');
insert into vault.secrets (name, secret)
select 'service_role_key', 'PEGA_AQUI_TU_SERVICE_ROLE_KEY'
where not exists (select 1 from vault.secrets where name = 'service_role_key');

-- (Re)programa el job.
select cron.unschedule('notify-due-daily')
  where exists (select 1 from cron.job where jobname = 'notify-due-daily');

select cron.schedule(
  'notify-due-daily',
  '0 17 * * *',                       -- 17:00 UTC = 12:00 PM COL
  $$
  select net.http_post(
    url     := 'https://tcowdwbepwrvossknyem.supabase.co/functions/v1/notify-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
