-- ALLOW-DESTRUCTIVE: (1) "delete from" internal_begin_function_call gövdesindeki mevcut 7 günlük ayıklama satırıdır; göç onu çalıştırmaz, fonksiyonu kilit şartıyla aynen yeniden tanımlar. (2) 2c bölümü geçmiş veli denetim kayıtlarından YALNIZ telefon anahtarını bilerek siler (KVKK, AGENTS.md "telefon düz metin olarak log'a gitmez"); satırlar ve adlar kalır.
-- Kilitli çağıran ve veli telefonu (2026-10-03, kapsamlı analiz turu).
--
-- İki bulgu, ikisi de 2026-09-19 gerçek kullanım turunda ölçülmüş ve açık
-- kalmıştı (ROADMAP §4.23 B1/B2, dilimler v1.5-20 ve v1.5-21):
--
-- 1. **Şifre kilidi Edge yolunda tutmuyordu.** Geçici şifresini değiştirmemiş
--    ya da süresi dolmuş bir yönetici PostgREST'ten hiçbir şey okuyamıyor ama
--    `create-member`, `change-member-role`, `remove-member` ve
--    `reset-member-password` ile üye açabiliyor, rol değiştirebiliyor, üye
--    çıkarabiliyor, şifre sıfırlayabiliyordu (K-25). Analiz turunda ilk kez
--    `create-member`'ın da kapanmadığı görüldü: `internal_create_membership`
--    HEDEFE kilit koyuyor, çağıranınkine bakmıyor. Kilit, sekiz fonksiyonun
--    hepsinin geçtiği istek kapısına (`internal_begin_function_call`) konur.
--    Ayrıca `platform_organization_stats` operatörün kilidine bakmıyordu;
--    operatörün okuma politikaları bakıyor, bu fonksiyon onlarla hizalanır.
--
-- 2. **Veli telefonu denetim kaydına düz metin yazılıyordu.** `AGENTS.md`:
--    "telefon düz metin olarak log'a gitmez". `audit_row_change` artık `~`
--    önekli sütunlar için DEĞERİ değil yalnız değişimi yazar ("changed":
--    ["phone"]). Mevcut satırlardaki telefonlar tek seferde silinir. Ad kalır:
--    Denetim Kaydı ekranı kaydın kime ait olduğunu ondan gösteriyor.

-- ---------------------------------------------------------------------------
-- 1a. İstek kapısı: çağıranın kilidi
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 1b. Platform istatistiği: operatörün kilidi
-- ---------------------------------------------------------------------------
create or replace function public.platform_organization_stats(target_organization_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- Kilitli operatör de sayıları göremez: okuma politikalarıyla aynı kural.
    when not public.current_user_is_platform_operator()
      or public.current_user_must_change_password() then null
    else jsonb_build_object(
      'member_count', (
        select count(*) from public.organization_memberships as uye
        where uye.organization_id = target_organization_id
      ),
      'admin_count', (
        select count(*) from public.organization_memberships as uye
        where uye.organization_id = target_organization_id and uye.role = 'admin'
      ),
      'branch_count', (
        select count(*) from public.branches as sube
        where sube.organization_id = target_organization_id
          and sube.archived_at is null
      ),
      'audit_event_count', (
        select count(*) from public.audit_events as olay
        where olay.organization_id = target_organization_id
      ),
      'student_count', (
        select count(*) from public.students as ogr
        where ogr.organization_id = target_organization_id
          and ogr.archived_at is null
      ),
      'guardian_count', (
        select count(*) from public.guardians as veli
        where veli.organization_id = target_organization_id
          and veli.archived_at is null
      )
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- 2a. Denetim tetikleyicisi: `~` önekli sütunun değeri yazılmaz
-- ---------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  varlik text := tg_argv[0];
  izlenen text[] := tg_argv[1:];
  yeni jsonb := to_jsonb(new);
  eski jsonb;
  eylem text;
  ayrinti jsonb := '{}'::jsonb;
  degisen text[] := array[]::text[];
  alan text;
  sutun text;
begin
  -- `~telefon` → değer yazılmaz; yalnız güncellemede "changed" listesine girer.
  foreach alan in array izlenen loop
    if left(alan, 1) <> '~' then
      ayrinti := ayrinti || jsonb_build_object(alan, yeni -> alan);
    end if;
  end loop;

  if tg_op = 'INSERT' then
    eylem := varlik || '.created';
  else
    eski := to_jsonb(old);

    if eski ->> 'archived_at' is null and yeni ->> 'archived_at' is not null then
      eylem := varlik || '.archived';
    elsif eski ->> 'archived_at' is not null and yeni ->> 'archived_at' is null then
      eylem := varlik || '.restored';
    else
      foreach alan in array izlenen loop
        sutun := ltrim(alan, '~');
        if (eski -> sutun) is distinct from (yeni -> sutun) then
          degisen := degisen || sutun;
        end if;
      end loop;

      if cardinality(degisen) = 0 then
        return null;
      end if;

      eylem := varlik || '.updated';
      ayrinti := ayrinti || jsonb_build_object('changed', to_jsonb(degisen));
    end if;
  end if;

  insert into public.audit_events (
    organization_id, branch_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  values (
    (yeni ->> 'organization_id')::uuid,
    (yeni ->> 'branch_id')::uuid,
    auth.uid(),
    eylem,
    varlik,
    (yeni ->> 'id')::uuid,
    ayrinti
  );

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2b. Veli tetikleyicileri telefonu maskeli izler
-- ---------------------------------------------------------------------------
create or replace trigger guardians_audit_insert
  after insert on public.guardians
  for each row execute function public.audit_row_change(
    'guardian', 'full_name', '~phone', 'auth_user_id'
  );

create or replace trigger guardians_audit_update
  after update on public.guardians
  for each row execute function public.audit_row_change(
    'guardian', 'full_name', '~phone', 'auth_user_id'
  );

-- ---------------------------------------------------------------------------
-- 2c. Geçmiş kayıtlardan telefon silinir (ad ve geri kalanı aynen kalır)
-- ---------------------------------------------------------------------------
update public.audit_events
   set metadata = metadata - 'phone'
 where entity_type = 'guardian'
   and metadata ? 'phone';
