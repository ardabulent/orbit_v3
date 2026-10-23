-- ALLOW-DESTRUCTIVE: `internal_purge_expired_records` gövdesindeki "delete from"lar yalnız saklama süresi (30 gün) dolmuş satırları siler: mesaj, mesaj bildirimi, mesajı kalmamış sohbet, ekran hata kaydı, e-posta defteri. Kurum sahibi kararı 2026-10-23 (ana plan 2.3, 2.14).
--
-- 30 gün sözü gerçekten tutulur (2026-10-23, ana plan 2.3 ve 2.14).
--
-- 1. Mesaj saklama süresi (2.3): kurum sahibi kararı "şimdilik 30 gün",
--    e-posta defteriyle aynı. Uygulama içi mesajlar bugüne kadar süresiz
--    duruyordu. Mesaj bildirimi mesajın ilk 200 karakterini taşıdığı için
--    (`notifications.body`) onunla birlikte gider; mesajı kalmamış sohbet de.
--    Öteki bildirim türleri (ödev, sınav, yoklama, duyuru) kişisel yazışma
--    değildir ve bu kararın kapsamında değildir.
--
-- 2. Ayıklama yazmaya bağlı kalmaz (2.14): `client_error_reports` ve
--    `email_deliveries` "30 gün" diyordu ama ayıklama yalnız bir sonraki
--    yazmada oluyordu; yazma gelmezse kayıt kalıyordu. Artık her gece
--    `pg_cron` işi çalışır (kurum sahibi onayı 2026-10-23: "Evet, aç").
--    Yazmadaki ayıklama da yerinde kalır; ikisi birbirini bozmaz.
--
-- 3. Hata paneli yalnız son 30 günü gösterir: gece işi çalışmadan önceki
--    birkaç saatte bile süresi dolmuş kayıt ekrana çıkmaz.
--
-- Taşınabilirlik: `pg_cron` düz Postgres eklentisidir (Supabase'e özgü
-- değil); kendi sunucuya taşınırsa aynı satır çalışır. Durdurmak için:
-- `select cron.unschedule('orbit-saklama-temizligi');`

create extension if not exists pg_cron;

create index if not exists messages_created_idx on public.messages (created_at);

create function public.internal_purge_expired_records()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sinir constant timestamptz := now() - interval '30 days';
  mesaj bigint;
  bildirim bigint;
  sohbet bigint;
  hata bigint;
  posta bigint;
begin
  delete from public.messages where created_at < sinir;
  get diagnostics mesaj = row_count;

  delete from public.notifications where kind = 'message' and created_at < sinir;
  get diagnostics bildirim = row_count;

  -- Son mesajı 30 günden eski (yani hiç mesajı kalmamış) sohbet; hiç mesaj
  -- yazılmamışsa açılış günü sayılır.
  delete from public.conversations as konusma
  where coalesce(konusma.last_message_at, konusma.created_at) < sinir
    and not exists (
      select 1 from public.messages as kalan where kalan.conversation_id = konusma.id
    );
  get diagnostics sohbet = row_count;

  delete from public.client_error_reports where created_at < sinir;
  get diagnostics hata = row_count;

  delete from public.email_deliveries where created_at < sinir;
  get diagnostics posta = row_count;

  return jsonb_build_object(
    'messages', mesaj,
    'message_notifications', bildirim,
    'conversations', sohbet,
    'client_error_reports', hata,
    'email_deliveries', posta
  );
end;
$$;

revoke all on function public.internal_purge_expired_records() from public, anon, authenticated;

comment on function public.internal_purge_expired_records() is
  'Saklama süresi (30 gün) dolmuş mesaj, mesaj bildirimi, boş sohbet, ekran hata kaydı ve e-posta defteri satırlarını siler; silinen sayıları döndürür. Her gece pg_cron "orbit-saklama-temizligi" çağırır. Kullanıcıya açık değil. 2026-10-23.';

create or replace function public.list_client_error_reports(
  before_created_at timestamp with time zone default null::timestamp with time zone,
  page_size integer default 50
)
returns table (
  id uuid,
  created_at timestamp with time zone,
  kind text,
  message text,
  stack text,
  path text,
  app_version text,
  user_agent text,
  organization_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rapor.id,
    rapor.created_at,
    rapor.kind,
    rapor.message,
    rapor.stack,
    rapor.path,
    rapor.app_version,
    rapor.user_agent,
    kurum.name
  from public.client_error_reports as rapor
  left join public.organizations as kurum on kurum.id = rapor.organization_id
  where (select public.current_user_is_platform_operator())
    and not (select public.current_user_must_change_password())
    -- Saklama süresi ekranda da geçerli (2026-10-23, ana plan 2.14).
    and rapor.created_at >= now() - interval '30 days'
    and (before_created_at is null or rapor.created_at < before_created_at)
  order by rapor.created_at desc, rapor.id desc
  limit least(greatest(coalesce(page_size, 50), 1), 200);
$$;

-- Her gece 00:00 UTC = 03:00 Türkiye. Aynı adla yeniden çağrılırsa iş
-- güncellenir, ikinci bir iş açılmaz.
select cron.schedule(
  'orbit-saklama-temizligi',
  '0 0 * * *',
  'select public.internal_purge_expired_records()'
);
