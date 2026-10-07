-- Ekrandaki hata bize ulaşır (2026-10-05, kapsamlı analiz 3. madde,
-- ROADMAP v1.5-06'nın hata izleme kısmı).
--
-- ALLOW-DESTRUCTIVE: report_client_error gövdesindeki "delete from" yalnız 30 günden eski hata kayıtlarını ayıklar (saklama süresi, KVKK veri en azlığı); göç hiçbir satır silmez.
--
-- Bugüne kadar kullanıcının ekranında bir hata olursa bunu ancak kullanıcı
-- söylerse öğreniyorduk. Karar (kullanıcı, 2026-10-05): üçüncü taraf bir araç
-- (Sentry vb.) değil, kendi veritabanımız. Gerekçe AGENTS.md kısıt 6 — düz
-- Postgres'le yapılabiliyor; ayrıca veri yurt dışında üçüncü bir firmaya
-- gitmiyor (KVKK) ve bütçe sıfır.
--
-- Tasarım:
--   * Tabloya kimsenin doğrudan yetkisi yok (RLS açık, politika yok, yetki
--     geri alındı). Yazma `report_client_error`, okuma
--     `list_client_error_reports` üzerinden.
--   * Yazma yalnız oturum açmış kullanıcıya açık; anonim yazma bir spam
--     kapısı olurdu. Kişi başına saatte 30 kayıt; fazlası sessizce düşer.
--   * Kişisel veri ayıklanır — istemci zaten ayıklıyor, sunucu ikinci kez:
--     e-posta → [e-posta], 6+ haneli sayı (TC, telefon, giriş no) → [sayı].
--     Alanlar kısaltılır. Adres yolundan sorgu ve parça (`?…`, `#…`) atılır.
--   * Şifre kilidi YAZMAYI engellemez: şifre değiştirme ekranındaki hata da
--     bilinmeli ve kayıt kimseye veri açmaz. OKUMA kilide tabidir.
--   * Saklama 30 gün. Arka plan işçisi yok; ayıklama her yazmada yapılır.
--   * Operatöre kullanıcı kimliği gösterilmez (veri en azlığı); kurum adı
--     gösterilir. Kimlik yalnız hız sınırı için tutulur.

create table public.client_error_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('error', 'unhandledrejection', 'render')),
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 4000),
  path text check (char_length(path) <= 200),
  app_version text check (char_length(app_version) <= 40),
  user_agent text check (char_length(user_agent) <= 200)
);

comment on table public.client_error_reports is
  'Tarayıcıda yakalanan hatalar. Doğrudan erişim yok; report_client_error / list_client_error_reports. 30 gün saklanır. 2026-10-05.';

create index client_error_reports_created_at_idx
  on public.client_error_reports (created_at desc);
create index client_error_reports_user_recent_idx
  on public.client_error_reports (user_id, created_at desc);

alter table public.client_error_reports enable row level security;
revoke all on public.client_error_reports from public, anon, authenticated;

-- Kişisel veri ayıklama. İstemcideki `scrubErrorText` ile aynı kurallar.
create function public.internal_scrub_error_text(raw text, max_length integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    regexp_replace(
      regexp_replace(
        coalesce(raw, ''),
        '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[e-posta]', 'g'
      ),
      '[0-9]{6,}', '[sayı]', 'g'
    ),
    max_length
  );
$$;

revoke all on function public.internal_scrub_error_text(text, integer)
  from public, anon, authenticated;

create function public.report_client_error(
  report_kind text,
  report_message text,
  report_stack text default null,
  report_path text default null,
  report_app_version text default null,
  report_user_agent text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  recent integer;
begin
  if caller is null
     or report_kind is null
     or report_kind not in ('error', 'unhandledrejection', 'render')
     or nullif(btrim(coalesce(report_message, '')), '') is null then
    return;
  end if;

  select count(*) into recent
  from public.client_error_reports as rapor
  where rapor.user_id = caller
    and rapor.created_at > now() - interval '1 hour';

  if recent >= 30 then
    return;
  end if;

  insert into public.client_error_reports (
    user_id, organization_id, kind, message, stack, path, app_version, user_agent
  )
  values (
    caller,
    (
      select uyelik.organization_id
      from public.organization_memberships as uyelik
      where uyelik.user_id = caller and uyelik.status = 'active'
      order by uyelik.created_at
      limit 1
    ),
    report_kind,
    public.internal_scrub_error_text(report_message, 500),
    nullif(public.internal_scrub_error_text(report_stack, 4000), ''),
    nullif(
      public.internal_scrub_error_text(
        split_part(split_part(coalesce(report_path, ''), '?', 1), '#', 1), 200
      ),
      ''
    ),
    nullif(left(coalesce(report_app_version, ''), 40), ''),
    nullif(left(coalesce(report_user_agent, ''), 200), '')
  );

  -- Saklama süresi: 30 gün. Küçük partiler, yazmayı yavaşlatmasın.
  delete from public.client_error_reports
  where id in (
    select eski.id
    from public.client_error_reports as eski
    where eski.created_at < now() - interval '30 days'
    limit 200
  );
end;
$$;

comment on function public.report_client_error(text, text, text, text, text, text) is
  'Tarayıcı hatasını kaydeder: kişisel veri ayıklanır, kişi başına saatte 30, 30 gün saklama. Oturumsuz çağrı sessizce düşer. 2026-10-05.';

revoke all on function public.report_client_error(text, text, text, text, text, text)
  from public, anon;
grant execute on function public.report_client_error(text, text, text, text, text, text)
  to authenticated;

create function public.list_client_error_reports(
  before_created_at timestamptz default null,
  page_size integer default 50
)
returns table (
  id uuid,
  created_at timestamptz,
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
    and (before_created_at is null or rapor.created_at < before_created_at)
  order by rapor.created_at desc, rapor.id desc
  limit least(greatest(coalesce(page_size, 50), 1), 200);
$$;

comment on function public.list_client_error_reports(timestamptz, integer) is
  'Hata kayıtları, yeniden eskiye. Yalnız etkin ve kilitsiz platform operatörüne satır döner; kullanıcı kimliği dönmez. 2026-10-05.';

revoke all on function public.list_client_error_reports(timestamptz, integer)
  from public, anon;
grant execute on function public.list_client_error_reports(timestamptz, integer)
  to authenticated;
