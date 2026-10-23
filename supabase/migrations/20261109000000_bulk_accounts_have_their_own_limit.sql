-- ALLOW-DESTRUCTIVE: internal_begin_function_call aynen yeniden tanımlanıyor (yalnız create-members-bulk satırı eklendi); gövdesindeki "delete from" 7 günden eski kapı defteri satırlarını ayıklayan mevcut satırdır, göç onu çalıştırmaz.
--
-- Toplu hesap açma fonksiyonunun hız sınırı (2026-10-23, ana plan 1.8).
--
-- `create-members-bulk` tanınmayan slug olarak varsayılan 10/saat'e düşerdi
-- (K-04). Sınır çağrı başınadır: 30 çağrı × 10 öğrenci = saatte 300 öğrenci
-- (velileriyle en çok 900 hesap). `create-member`'ın 60/saat sınırından geniş
-- olmasının gerekçesi: bu fonksiyon ad almaz, yalnız çağıranın RLS ile
-- görebildiği ve hesabı OLMAYAN öğrenci/veli kaydına hesap açar — açılabilecek
-- hesap sayısı kurumdaki kayıt sayısıyla sınırlıdır. Gerekçe ayrıntısı:
-- supabase/functions/create-members-bulk/index.ts ve DECISION_LOG.

CREATE OR REPLACE FUNCTION public.internal_begin_function_call(function_slug text, caller_user_id uuid, idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  saatlik_sinir integer;
  mevcut public.internal_function_calls%rowtype;
  pencere_sayisi integer;
  yeni_id bigint;
begin
  -- 🔴 Çağıranın şifre kilidi (2026-10-03, v1.5-20). Bütün Edge
  -- fonksiyonları işe başlamadan bu kapıdan geçer; kilit burada durursa sekiz
  -- fonksiyonun sekizi de kapanır. Ölçüldü: kilitli bir yönetici normal
  -- ekranlarda hiçbir şey okuyamazken üye açabiliyor, rol değiştirebiliyor,
  -- üye çıkarabiliyor ve şifre sıfırlayabiliyordu. İfade
  -- `current_user_must_change_password()` ve `internal_begin_account_switch`
  -- ile aynı: süresi dolmuş geçici şifre de kilittir. Hız sınırından ve tekrar
  -- korumasından ÖNCE: kilitli çağıran bir tekrarın sonucunu da alamaz.
  if exists (
    select 1 from public.profiles as cagiran
    where cagiran.id = internal_begin_function_call.caller_user_id
      and (
        cagiran.must_change_password
        or (cagiran.password_expires_at is not null
            and cagiran.password_expires_at <= now())
      )
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'password_locked');
  end if;
  saatlik_sinir := case internal_begin_function_call.function_slug
    when 'create-member' then 60
    when 'reset-member-password' then 30
    when 'reset-admin-password' then 30
    when 'bootstrap-organization' then 10
    when 'delete-organization' then 5
    -- Hesap değiştirme, rol değiştirme ve üye çıkarma (2026-10-07, B9):
    -- bunlar varsayılan 10/saat'e düşüyordu; hem veli hem öğretmen olan biri
    -- gün içinde 11. hesap değişiminde reddediliyordu (ölçüldü, §4.23 B9).
    when 'switch-account' then 120
    when 'change-member-role' then 60
    when 'remove-member' then 60
    -- Toplu hesap açma (2026-10-23, ana plan 1.8): çağrı başına en çok 10
    -- öğrenci (velileriyle en çok 30 hesap). Yalnız hesabı OLMAYAN var olan
    -- kayda, kayıttaki adla açar; keyfi hesap üretemez. Bkz. fonksiyonun başı.
    when 'create-members-bulk' then 30
    -- Tanınmayan bir slug sessizce sınırsız kalmamalı (K-04).
    else 10
  end;

  -- Ayıklama: yalnızca bu çağıranın bu fonksiyona ait eski satırları.
  delete from public.internal_function_calls as eski
  where eski.caller_user_id = internal_begin_function_call.caller_user_id
    and eski.function_slug = internal_begin_function_call.function_slug
    and eski.created_at < now() - interval '7 days';

  if internal_begin_function_call.idempotency_key is not null then
    select * into mevcut
    from public.internal_function_calls as kayit
    where kayit.function_slug = internal_begin_function_call.function_slug
      and kayit.caller_user_id = internal_begin_function_call.caller_user_id
      and kayit.idempotency_key = internal_begin_function_call.idempotency_key;

    if found then
      if mevcut.completed_at is not null then
        return jsonb_build_object(
          'allowed', false, 'reason', 'replay', 'outcome', mevcut.outcome
        );
      end if;

      -- Aynı anahtarla eşzamanlı ikinci istek. İşi tekrar yapmak yerine
      -- çağıranı bekletmek doğru: birincisi bitince tekrar sorabilir.
      return jsonb_build_object('allowed', false, 'reason', 'in_progress');
    end if;
  end if;

  select count(*) into pencere_sayisi
  from public.internal_function_calls as kayit
  where kayit.caller_user_id = internal_begin_function_call.caller_user_id
    and kayit.function_slug = internal_begin_function_call.function_slug
    and kayit.created_at > now() - interval '1 hour';

  if pencere_sayisi >= saatlik_sinir then
    return jsonb_build_object(
      'allowed', false, 'reason', 'rate_limited', 'limit', saatlik_sinir
    );
  end if;

  insert into public.internal_function_calls (
    function_slug, caller_user_id, idempotency_key
  )
  values (
    internal_begin_function_call.function_slug,
    internal_begin_function_call.caller_user_id,
    internal_begin_function_call.idempotency_key
  )
  -- Yarış: aynı anahtarla iki istek yukarıdaki okumayı birlikte geçebilir.
  -- Benzersiz indeks birini eler; elenen taraf işi yapmaz.
  on conflict do nothing
  returning id into yeni_id;

  if yeni_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'in_progress');
  end if;

  return jsonb_build_object('allowed', true, 'call_id', yeni_id);
end;
$function$;
