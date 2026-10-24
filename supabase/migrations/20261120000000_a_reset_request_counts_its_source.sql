-- ALLOW-DESTRUCTIVE: `delete from` ifadeleri yalnız fonksiyon gövdelerindedir;
-- göç uygulanırken hiçbir satır silinmez. `internal_purge_expired_records`e
-- bu göçün kendi tablosunun bir günden eski satırları eklendi.
--
-- Ana plan 2.13 · Şifre sıfırlama isteğinin kaynak başına sınırı (2026-10-25)
--
-- "Şifremi unuttum" oturumsuz çağrılır. Sınır iki katmandı: kişi başına saatte
-- 3, sistemde saatte 100 gönderim. Açık: giriş numaraları tahmin edilebilir
-- (kurum kodu + sıra), tek bir kaynaktan 34 numaraya üçer istek sistem
-- sınırını doldurur ve **herkes** bir saat şifresini sıfırlayamaz.
--
-- Üçüncü katman: kaynak başına saatte 10 istek (var olmayan numaralar dahil).
-- Sistem sınırını tek kaynaktan doldurmak artık mümkün değil; en az on ayrı
-- kaynak gerekir.
--
-- Kaynak nedir: Cloudflare'in yazdığı `cf-connecting-ip` başlığı (istemcinin
-- gönderdiği değeri Cloudflare ezer; canlı ağ geçidi günlüklerinde
-- 2026-10-25'te görüldü). Edge Function IP'yi **saklamaz**: servis anahtarıyla
-- HMAC-SHA256 özeti çıkarır, veritabanına yalnız özet gelir. Anahtar olmadan
-- özetten IP'ye dönülemez; satırlar bir gün sonra gece işiyle silinir (KVKK:
-- kötüye kullanımı önleme, en kısa süre).
--
-- Başlık gelmezse kaynak "bilinmiyor" sayılır ve kovası sistem sınırına (100)
-- eşittir: bugünkü davranış aynen sürer, kimse ortak bir kovaya kilitlenmez.
-- `source_known` sütunu canlıda başlığın gerçekten gelip gelmediğini gösterir.

create table public.password_reset_sources (
  id bigint generated always as identity primary key,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  source_known boolean not null,
  created_at timestamptz not null default now()
);

create index password_reset_sources_window_idx
  on public.password_reset_sources (source_hash, created_at desc);

alter table public.password_reset_sources enable row level security;
revoke all on public.password_reset_sources from anon, authenticated;
grant all on public.password_reset_sources to service_role;

comment on table public.password_reset_sources is
  'Şifre sıfırlama isteklerinin kaynak özeti (IP değil, HMAC-SHA256). Kaynak başına saatlik sınır için; bir gün saklanır. Yalnız service_role.';

drop function public.internal_claim_password_reset(text);

CREATE FUNCTION public.internal_claim_password_reset(
  target_login_email text,
  request_source text DEFAULT NULL::text,
  request_source_known boolean DEFAULT false
)
 RETURNS TABLE(user_id uuid, auth_email text, destination text, delivery_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  kullanici uuid;
  giris text;
  hedef text;
  kaynak_siniri integer;
begin
  -- Kaynak başına sınır (2026-10-25, ana plan 2.13). Hesap aranmadan ÖNCE:
  -- var olmayan numaralar için yapılan istekler de sayılır. Sınırı aşan istek
  -- satır yazmaz; kaynak başına satır sayısı saatte sınırla tavanlanır.
  -- Kaynak bilinmiyorsa (başlık gelmedi) kova sistem sınırına eşittir: ek bir
  -- kısıt koymaz, bugünkü davranış aynen sürer.
  if request_source is not null then
    perform pg_advisory_xact_lock(hashtext('password_reset_sources:' || request_source));
    kaynak_siniri := 100;
    if request_source_known then
      kaynak_siniri := 10;
    end if;
    if (select count(*) from public.password_reset_sources as kaynak
        where kaynak.source_hash = request_source
          and kaynak.created_at > now() - interval '1 hour') >= kaynak_siniri
    then
      return;
    end if;
    insert into public.password_reset_sources (source_hash, source_known)
    values (request_source, request_source_known);
  end if;

  select kisi.id, kisi.email into kullanici, giris
  from auth.users as kisi
  where lower(kisi.email) = lower(btrim(target_login_email))
    and kisi.deleted_at is null
    and (kisi.banned_until is null or kisi.banned_until <= now());

  if kullanici is null then
    return;
  end if;

  if not exists (
       select 1 from public.organization_memberships as uyelik
       where uyelik.user_id = kullanici and uyelik.status = 'active')
     and not exists (
       select 1 from public.platform_operators as operator
       where operator.user_id = kullanici and operator.status = 'active')
  then
    return;
  end if;

  select nullif(btrim(profil.recovery_email), '') into hedef
  from public.profiles as profil where profil.id = kullanici;

  if hedef is null and giris not like '%@orbit.invalid' then
    hedef := giris;
  end if;
  if hedef is null then
    return;
  end if;

  -- Eşzamanlı iki istek aynı sayımı birlikte geçmesin.
  perform pg_advisory_xact_lock(hashtext('email_deliveries:password_reset'));

  if (select count(*) from public.email_deliveries as kayit
      where kayit.kind = 'password_reset' and kayit.user_id = kullanici
        and kayit.created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.email_deliveries as kayit
         where kayit.kind = 'password_reset'
           and kayit.created_at > now() - interval '1 hour') >= 100
  then
    return;
  end if;

  user_id := kullanici;
  auth_email := giris;
  destination := hedef;
  delivery_id := public.internal_begin_email_delivery(kullanici, 'password_reset');
  return next;
end;
$function$;

comment on function public.internal_claim_password_reset(text, text, boolean) is
  'Şifre sıfırlama gönderimini ayırır. Sınırlar: kaynak başına saatte 10 (kaynak bilinmiyorsa 100), kişi başına saatte 3, sistemde saatte 100. Hesap yoksa, kurtarma adresi yoksa ya da sınır doluysa satır döndürmez (yanıt her durumda aynı).';

revoke all on function public.internal_claim_password_reset(text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.internal_claim_password_reset(text, text, boolean)
  to service_role;

create or replace function public.internal_purge_expired_records()
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
  defter bigint;
  kaynak bigint;
  ozet jsonb;
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

  -- Kapı defteri 30 değil 7 gün: tekrar koruması ve hız sınırı bundan eskiye
  -- hiç bakmıyor (`internal_begin_function_call`).
  delete from public.internal_function_calls
  where created_at < now() - interval '7 days';
  get diagnostics defter = row_count;

  -- Şifre sıfırlama kaynak özetleri bir gün (sınır yalnız son saate bakar).
  delete from public.password_reset_sources
  where created_at < now() - interval '1 day';
  get diagnostics kaynak = row_count;

  ozet := jsonb_build_object(
    'messages', mesaj,
    'message_notifications', bildirim,
    'conversations', sohbet,
    'client_error_reports', hata,
    'email_deliveries', posta,
    'function_calls', defter,
    'password_reset_sources', kaynak
  );

  -- Bir şey silindiyse ne kadar silindiği kalıcı olarak yazılır (yalnız
  -- sayılar; içerik değil). Hiçbir şey silinmeyen gece satır yazmaz.
  if mesaj + bildirim + sohbet + hata + posta + defter + kaynak > 0 then
    insert into public.platform_audit_events (actor_user_id, action, entity_type, metadata)
    values (null, 'platform.retention_purged', 'retention', ozet);
  end if;

  return ozet;
end;
$$;

revoke all on function public.internal_purge_expired_records()
  from public, anon, authenticated;
