-- ALLOW-DESTRUCTIVE: göç hiçbir şey silmez; "delete from" yalnız fonksiyon gövdelerindedir — süresi geçmiş doğrulama kodları ve bir günden eski sıfırlama istek sayaçları (KVKK: veri en az).
--
-- Unutulan şifre kurtarma adresine ulaşır (2026-10-13, #118'in ikinci yarısı).
--
-- Karar 2026-08-24'te alınmıştı (DECISION_LOG "Auth e-postası hiç değişmez;
-- kurtarma linkini biz üretir, biz göndeririz"); eksik olan gönderim yoluydu.
-- Artık Edge fonksiyonları SMTP ile e-posta gönderebiliyor (`_shared/mailer.ts`).
--
-- İki akış:
--
-- 1. **Kurtarma adresi eklemek** (Ayarlar → Profil). Kişi adresini yazar,
--    `recovery-email` fonksiyonu 6 haneli kodu o adrese gönderir, kişi kodu
--    `confirm_recovery_email` ile geri girer ve adres `profiles.recovery_email`'e
--    ancak o zaman yazılır. Kod hash'li durur, 15 dakika geçerlidir, en çok 5
--    deneme hakkı vardır (10^6 olasılıkta 5 deneme: kaba kuvvet anlamsız).
--    `recovery_email` sütununa doğrudan yazma yetkisi yine YOK (göç
--    20260825210000): hesaba kısa süre erişen biri doğrulamadan kalıcı arka
--    kapı bırakamasın.
--
-- 2. **Şifremi unuttum** (giriş ekranı). Numara ya da e-posta yazılır,
--    `request-password-reset` fonksiyonu `internal_password_reset_target` ile
--    hedefi çözer: doğrulanmış kurtarma adresi varsa oraya, yoksa giriş adresi
--    gerçek bir adresse (yönetici, operatör) oraya gönderir; `…@orbit.invalid`
--    adresine hiçbir şey gönderilmez. Hesabın var olup olmadığı yanıttan
--    anlaşılmaz. Sayaç: kişi başına saatte 3, bütün sistemde saatte 100
--    gönderim (Gmail'in günlük kotasını rastgele numaralarla tüketmek mümkün
--    olmasın; olmayan hesap için zaten gönderim yok).

-- 1. Doğrulama kodları ------------------------------------------------------------

create table public.recovery_email_challenges (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (email like '%_@_%._%' and char_length(email) <= 254),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.recovery_email_challenges is
  'Kurtarma adresi doğrulama kodları. Kişi başına tek bekleyen kod; kod hash''li durur, 15 dakika geçerli, 5 deneme. Politika yok: yalnız security definer fonksiyonlar dokunur (account_link_codes ile aynı kalıp).';

alter table public.recovery_email_challenges enable row level security;

-- 2. Sıfırlama istek sayacı ------------------------------------------------------

create table public.password_reset_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index password_reset_requests_user_idx
  on public.password_reset_requests (user_id, created_at desc);
create index password_reset_requests_created_idx
  on public.password_reset_requests (created_at);

comment on table public.password_reset_requests is
  'Gönderilen şifre sıfırlama e-postalarının sayacı (hız sınırı). Adres ya da numara tutmaz; bir günden eski satırlar her yeni istekte silinir.';

alter table public.password_reset_requests enable row level security;

-- İki tabloya da hiçbir oturum dokunmaz; Supabase'in varsayılan yetkileri
-- geri alınır (politika olmaması zaten kapatıyor, yetki de kalmasın —
-- `every_write_leaves_a_trace` yazılabilir her tabloda iz arar).
revoke all on public.recovery_email_challenges, public.password_reset_requests
  from anon, authenticated;

-- 3. Kurtarma adresi: kod üret (yalnız Edge fonksiyonu) ---------------------------

create function public.internal_start_recovery_email_challenge(
  target_user_id uuid,
  target_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  adres text := lower(btrim(target_email));
  kod text;
begin
  if adres is null or adres !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(adres) > 254 then
    raise exception 'Geçerli bir e-posta adresi yazın.' using errcode = '22023';
  end if;
  if adres like '%@orbit.invalid' then
    raise exception 'Bu adres kurtarma için kullanılamaz; size ait gerçek bir e-posta adresi yazın.'
      using errcode = '22023';
  end if;

  delete from public.recovery_email_challenges as eski
  where eski.expires_at < now() - interval '1 day';

  kod := lpad(
    (abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 15))::bit(60)::bigint)
      % 1000000)::text,
    6, '0');

  insert into public.recovery_email_challenges (user_id, email, code_hash, expires_at)
  values (
    target_user_id, adres,
    encode(sha256(convert_to(target_user_id::text || ':' || kod, 'utf8')), 'hex'),
    now() + interval '15 minutes')
  on conflict (user_id) do update
    set email = excluded.email,
        code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        created_at = now();

  return kod;
end;
$$;

revoke all on function public.internal_start_recovery_email_challenge(uuid, text)
  from public, anon, authenticated;

-- 4. Kurtarma adresi: kodu doğrula (kullanıcı) -----------------------------------

create function public.confirm_recovery_email(verification_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ben uuid := (select auth.uid());
  bekleyen public.recovery_email_challenges%rowtype;
begin
  if ben is null then
    raise exception 'Oturum yok' using errcode = '42501';
  end if;
  if public.current_user_must_change_password() then
    raise exception 'Önce şifrenizi değiştirmeniz gerekiyor.' using errcode = '42501';
  end if;

  select * into bekleyen
  from public.recovery_email_challenges as kod
  where kod.user_id = ben
  for update;

  if not found or bekleyen.expires_at <= now() then
    raise exception 'Kod geçersiz ya da süresi dolmuş. Yeni kod isteyin.' using errcode = 'ORB08';
  end if;
  if bekleyen.attempts >= 5 then
    raise exception 'Çok fazla hatalı deneme yapıldı. Yeni kod isteyin.' using errcode = 'ORB08';
  end if;

  if bekleyen.code_hash is distinct from encode(
       sha256(convert_to(ben::text || ':' || btrim(coalesce(verification_code, '')), 'utf8')), 'hex')
  then
    update public.recovery_email_challenges as kod
    set attempts = kod.attempts + 1
    where kod.user_id = ben;
    -- Deneme sayısı hata fırlatılırsa geri alınırdı; bu yüzden hata yerine
    -- boş dönülür ve istemci "kod hatalı" der.
    return null;
  end if;

  update public.profiles as profil
  set recovery_email = bekleyen.email
  where profil.id = ben;

  delete from public.recovery_email_challenges as kod where kod.user_id = ben;

  return bekleyen.email;
end;
$$;

revoke all on function public.confirm_recovery_email(text) from public, anon;
grant execute on function public.confirm_recovery_email(text) to authenticated;

-- 5. Kurtarma adresini kaldırmak --------------------------------------------------

create function public.remove_my_recovery_email()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ben uuid := (select auth.uid());
begin
  if ben is null then
    raise exception 'Oturum yok' using errcode = '42501';
  end if;
  if public.current_user_must_change_password() then
    raise exception 'Önce şifrenizi değiştirmeniz gerekiyor.' using errcode = '42501';
  end if;
  update public.profiles as profil set recovery_email = null where profil.id = ben;
  delete from public.recovery_email_challenges as kod where kod.user_id = ben;
end;
$$;

revoke all on function public.remove_my_recovery_email() from public, anon;
grant execute on function public.remove_my_recovery_email() to authenticated;

-- 6. Şifremi unuttum: hedefi çöz ve sayacı al (yalnız Edge fonksiyonu) -----------

-- Giriş adresinden (gerçek ya da `<numara>@orbit.invalid`) gönderilecek adresi
-- bulur. Hesap yoksa, etkin üyeliği ya da operatörlüğü yoksa, gidecek adres
-- yoksa ya da sınır dolduysa BOŞ döner — hepsi çağırana aynı görünür.
create function public.internal_claim_password_reset(target_login_email text)
returns table (user_id uuid, auth_email text, destination text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  kullanici uuid;
  giris text;
  hedef text;
begin
  delete from public.password_reset_requests as eski
  where eski.created_at < now() - interval '1 day';

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
  perform pg_advisory_xact_lock(hashtext('password_reset_requests'));

  if (select count(*) from public.password_reset_requests as istek
      where istek.user_id = kullanici and istek.created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.password_reset_requests as istek
         where istek.created_at > now() - interval '1 hour') >= 100
  then
    return;
  end if;

  insert into public.password_reset_requests (user_id) values (kullanici);

  user_id := kullanici;
  auth_email := giris;
  destination := hedef;
  return next;
end;
$$;

revoke all on function public.internal_claim_password_reset(text)
  from public, anon, authenticated;
