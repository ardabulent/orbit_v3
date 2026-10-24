-- ALLOW-DESTRUCTIVE: Dosyadaki `delete from` ifadelerinin hepsi FONKSİYON
-- GÖVDELERİNİN içindedir; göç uygulanırken hiçbir satır silinmez.
--   * `platform_purge_organization` — operatörün elle, kurum kodunu yazarak
--     ve kurum en az 30 gündür kapalıysa çağırabildiği boşaltma.
--   * `internal_purge_expired_records` — gece işine 7 günden eski kapı
--     defteri satırları eklendi (defterin kendi saklama süresi zaten 7 gün).
--   * `internal_begin_function_call` — gövdesi aynen korunur; yalnız kilit
--     koşuluna kapalı kurum eklendi.
--
-- Ana plan 2.5 · Kurum kapatma ve boşaltma (2026-10-25)
--
-- Bugün içinde öğrenci, not veya ödeme olan bir kurum hiçbir yolla
-- silinemiyor (bilinçli, `internal_delete_organization`, 2026-09-02). Ama
-- ayrılan kurumun verisini KVKK gereği silmek zorundayız. O kararın kendisi
-- yolu tarif etmişti: "kaldırma yolunu ayrı bir yetki ve ayrı bir denetim
-- kaydıyla tasarlamak — bu fonksiyonun korumasını gevşetmek değil."
--
-- Kurum sahibinin kararı (2026-10-25): iki adım ve 30 gün.
--
--   1. **Kapatma** (`platform_close_organization`) — geri alınabilir. Kurumun
--      hiçbir kullanıcısı hiçbir şey okuyamaz ve yazamaz; veri yerinde durur.
--   2. **Boşaltma** (`platform_purge_organization`) — geri alınamaz. Kurum en
--      az 30 gündür kapalıysa ve operatör kurum kodunu yazarsa bütün içerik
--      silinir; platform denetim kaydına tablo tablo kaç satır silindiği
--      yazılır (içerik değil, yalnız sayı).
--   3. Sonra bugünkü "Kurumu sil" çalışır (hesaplar, üyelikler, şubeler).
--      O fonksiyona dokunulmadı; koruması aynen duruyor.
--
-- Kilit nasıl kuruldu: yeni bir kural 112 politikaya tek tek eklenmedi.
-- Politikaların 108'i ve kilit sorgulayan RPC'lerin hepsi zaten
-- `current_user_must_change_password()` soruyor ("bu çağıran şu an kilitli
-- mi"). Kapalı kurumun kullanıcısı artık o soruya "evet" cevabı alır. Adı
-- dar kaldı ama soru aynıdır; yeniden adlandırmak 108 politikayı yeniden
-- yazmak demekti ve bir kazancı yoktu. İstemci kapalı kurumu kendisi görüp
-- şifre ekranı yerine "kurum kapatıldı" ekranı gösterir.

-- ---------------------------------------------------------------------------
-- 1. Bekleme süresi — tek kaynak
-- ---------------------------------------------------------------------------
create or replace function public.organization_purge_waiting_period()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '30 days';
$$;

revoke all on function public.organization_purge_waiting_period()
  from public, anon, authenticated;

comment on function public.organization_purge_waiting_period() is
  'Kapatılan bir kurumun boşaltılabilmesi için geçmesi gereken süre (2026-10-25 kararı: 30 gün). Sayaç ve boşaltma bu fonksiyondan okur.';

-- ---------------------------------------------------------------------------
-- 2. Kapalı kurum kilidi
-- ---------------------------------------------------------------------------
create or replace function public.internal_user_in_closed_organization(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Platform operatörü kapalı kurum yüzünden kilitlenmez: kurumu yeniden
  -- açacak ya da boşaltacak olan odur.
  select not exists (
      select 1 from public.platform_operators as op
      where op.user_id = target_user_id
    )
    and exists (
      select 1
      from public.organization_memberships as uyelik
      join public.organizations as kurum on kurum.id = uyelik.organization_id
      where uyelik.user_id = target_user_id
        and kurum.archived_at is not null
      union all
      -- Öğrenci ve veli hesapları kayda `auth_user_id` ile de bağlanır
      -- (`current_user_scope_org_ids`); üyelik dışındaki bu yol da kapanır.
      select 1
      from public.students as ogrenci
      join public.organizations as kurum on kurum.id = ogrenci.organization_id
      where ogrenci.auth_user_id = target_user_id
        and kurum.archived_at is not null
      union all
      select 1
      from public.guardians as veli
      join public.organizations as kurum on kurum.id = veli.organization_id
      where veli.auth_user_id = target_user_id
        and kurum.archived_at is not null
    );
$$;

comment on function public.internal_user_in_closed_organization(uuid) is
  'Kullanıcı kapatılmış (archived_at dolu) bir kuruma bağlı mı? Üyelik, öğrenci ve veli bağına bakar; platform operatörü için her zaman false.';

revoke all on function public.internal_user_in_closed_organization(uuid)
  from public, anon, authenticated;

create or replace function public.current_user_must_change_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select
        profile.must_change_password
        or (
          profile.password_expires_at is not null
          and profile.password_expires_at <= now()
        )
      from public.profiles as profile
      where profile.id = (select auth.uid())
    ),
    true
  )
  -- 2026-10-25 (ana plan 2.5): kapatılmış kurumun kullanıcısı da kilitlidir.
  or public.internal_user_in_closed_organization((select auth.uid()));
$$;

comment on function public.current_user_must_change_password() is
  'Çağıran kilitli mi: şifresini değiştirmek zorunda, geçici şifresinin süresi dolmuş ya da kurumu kapatılmış (2026-10-25). Politikaların ve RPC''lerin ortak kilit sorusu; adı tarihsel.';

-- ---------------------------------------------------------------------------
-- 3. Kurumun içerik tabloları — tek kaynak
-- ---------------------------------------------------------------------------
-- `internal_delete_organization` ile aynı ölçüt: `public` şemasında
-- `organization_id` taşıyan ve yapısal olmayan her tablo içeriktir. Yeni bir
-- tablo eklendiği gün kimse bir şey yazmadan sayaca ve boşaltmaya girer.
create or replace function public.internal_organization_content_tables()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select c.relname::text
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  join pg_catalog.pg_attribute as a on a.attrelid = c.oid
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relispartition
    and a.attname = 'organization_id'
    and a.attnum > 0
    and not a.attisdropped
    and c.relname <> all (array[
      'branches',
      'organization_memberships',
      'audit_events',
      'platform_audit_events'
    ])
  order by c.relname;
$$;

comment on function public.internal_organization_content_tables() is
  'Kurum içeriği sayılan tablolar: organization_id taşıyan ve yapısal dört tablo (branches, organization_memberships, audit_events, platform_audit_events) dışındaki her public tablo. internal_delete_organization ile aynı ölçüt.';

revoke all on function public.internal_organization_content_tables()
  from public, anon, authenticated;

create or replace function public.internal_organization_content_counts(target_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tablo text;
  adet bigint;
  sonuc jsonb := '{}'::jsonb;
begin
  for tablo in select public.internal_organization_content_tables() loop
    execute format(
      'select count(*) from public.%I where organization_id = $1', tablo
    ) into adet using target_organization_id;
    if adet > 0 then
      sonuc := sonuc || jsonb_build_object(tablo, adet);
    end if;
  end loop;
  return sonuc;
end;
$$;

comment on function public.internal_organization_content_counts(uuid) is
  'Kurumun dolu içerik tablolarının satır sayıları ({tablo: adet}); boş tablo yazılmaz. Kişisel veri içermez.';

revoke all on function public.internal_organization_content_counts(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Operatörün sayaçları: eksiksiz içerik + kapanış durumu
-- ---------------------------------------------------------------------------
-- Önceki hâl yalnız üyelik, şube, denetim, öğrenci ve veli sayıyordu; silme
-- onay ekranı ders programı, sınav, ödeme gibi tablolarda "boş" görünüyordu
-- (2026-09-02 kararının "kapsam dışı" notu). `content` artık her içerik
-- tablosunu kapsar. Eski anahtarlar korunur.
drop function if exists public.platform_organization_stats(uuid);

create function public.platform_organization_stats(target_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  kapanis timestamptz;
begin
  -- Kilitli operatör de sayıları göremez: okuma politikalarıyla aynı kural.
  if not public.current_user_is_platform_operator()
    or public.current_user_must_change_password() then
    return null;
  end if;

  select kurum.archived_at into kapanis
  from public.organizations as kurum
  where kurum.id = target_organization_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
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
    ),
    'content', public.internal_organization_content_counts(target_organization_id),
    'closed_at', kapanis,
    'purge_available_at', kapanis + public.organization_purge_waiting_period()
  );
end;
$$;

comment on function public.platform_organization_stats(uuid) is
  'Platform operatörüne kurumun yalnız sayılarını verir: üyelik, şube, denetim, öğrenci, veli, her içerik tablosunun satır sayısı (content) ve kapanış durumu (closed_at, purge_available_at). Kişisel veri içermez.';

revoke all on function public.platform_organization_stats(uuid) from public, anon;
grant execute on function public.platform_organization_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Kapatma ve yeniden açma
-- ---------------------------------------------------------------------------
create or replace function public.platform_close_organization(target_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  kurum public.organizations%rowtype;
begin
  if not public.current_user_is_platform_operator()
    or public.current_user_must_change_password() then
    raise exception 'Bu işlem için platform operatörü yetkisi gerekiyor.'
      using errcode = '42501';
  end if;

  select * into kurum from public.organizations as o
  where o.id = target_organization_id
  for update;

  if not found then
    raise exception 'Kurum bulunamadı.' using errcode = '23503';
  end if;

  -- Zaten kapalıysa saat yeniden başlamaz: tekrar basmak bekleme süresini
  -- uzatmamalı, kısaltmamalı da.
  if kurum.archived_at is null then
    update public.organizations as o
    set archived_at = now(), updated_at = now()
    where o.id = target_organization_id
    returning * into kurum;

    insert into public.platform_audit_events (
      actor_user_id, action, entity_type, entity_id, organization_id, metadata
    )
    values (
      (select auth.uid()),
      'platform.organization_closed',
      'organization',
      kurum.id,
      kurum.id,
      jsonb_build_object(
        'organization_name', kurum.name,
        'organization_code', kurum.code
      )
    );
  end if;

  return jsonb_build_object(
    'closed_at', kurum.archived_at,
    'purge_available_at',
      kurum.archived_at + public.organization_purge_waiting_period()
  );
end;
$$;

comment on function public.platform_close_organization(uuid) is
  'Kurumu kapatır (organizations.archived_at). Geri alınabilir; kurumun kullanıcıları kilitlenir, veri yerinde kalır. Yalnız kilitsiz platform operatörü. Platform denetim kaydına yazar.';

revoke all on function public.platform_close_organization(uuid) from public, anon;
grant execute on function public.platform_close_organization(uuid) to authenticated;

create or replace function public.platform_reopen_organization(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  kurum public.organizations%rowtype;
begin
  if not public.current_user_is_platform_operator()
    or public.current_user_must_change_password() then
    raise exception 'Bu işlem için platform operatörü yetkisi gerekiyor.'
      using errcode = '42501';
  end if;

  select * into kurum from public.organizations as o
  where o.id = target_organization_id
  for update;

  if not found then
    raise exception 'Kurum bulunamadı.' using errcode = '23503';
  end if;

  if kurum.archived_at is null then
    return;
  end if;

  update public.organizations as o
  set archived_at = null, updated_at = now()
  where o.id = target_organization_id;

  insert into public.platform_audit_events (
    actor_user_id, action, entity_type, entity_id, organization_id, metadata
  )
  values (
    (select auth.uid()),
    'platform.organization_reopened',
    'organization',
    kurum.id,
    kurum.id,
    jsonb_build_object(
      'organization_name', kurum.name,
      'organization_code', kurum.code,
      'closed_at', kurum.archived_at
    )
  );
end;
$$;

comment on function public.platform_reopen_organization(uuid) is
  'Kapatılan kurumu yeniden açar; kullanıcıların kilidi kalkar. Boşaltılmış bir kurumun verisi geri gelmez. Platform denetim kaydına yazar.';

revoke all on function public.platform_reopen_organization(uuid) from public, anon;
grant execute on function public.platform_reopen_organization(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Boşaltma
-- ---------------------------------------------------------------------------
create or replace function public.platform_purge_organization(
  target_organization_id uuid,
  confirmation_code integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  kurum public.organizations%rowtype;
  sayilar jsonb;
  kalan jsonb;
  tablo text;
  silinen bigint;
  ilerledi boolean;
  tur integer := 0;
  denetim bigint;
  toplam bigint;
begin
  if not public.current_user_is_platform_operator()
    or public.current_user_must_change_password() then
    raise exception 'Bu işlem için platform operatörü yetkisi gerekiyor.'
      using errcode = '42501';
  end if;

  select * into kurum from public.organizations as o
  where o.id = target_organization_id
  for update;

  if not found then
    raise exception 'Kurum bulunamadı.' using errcode = '23503';
  end if;

  -- Onay sunucuda da doğrulanır: yalnız istemcide sorulsaydı doğrudan API
  -- çağrısı için hiçbir engel olmazdı.
  if confirmation_code is distinct from kurum.code then
    raise exception 'Yazılan kod kurum koduyla eşleşmiyor.'
      using errcode = '22023';
  end if;

  if kurum.archived_at is null then
    raise exception 'Kurum kapatılmadan boşaltılamaz.'
      using errcode = 'ORB02';
  end if;

  if kurum.archived_at + public.organization_purge_waiting_period() > now() then
    raise exception 'Bekleme süresi dolmadı.'
      using errcode = 'ORB03',
            detail = (kurum.archived_at + public.organization_purge_waiting_period())::text;
  end if;

  -- Sayılar silmeden ÖNCE alınır: tablolar arası `on delete cascade` bir
  -- tablonun satırlarını başka bir tablonun silmesiyle götürebilir ve sonra
  -- sayılan rakam eksik olurdu.
  sayilar := public.internal_organization_content_counts(target_organization_id);

  -- Tablolar birbirine yabancı anahtarla bağlı (sonuç → sınav, yoklama →
  -- oturum…). Sabit bir sıra yazmak her yeni tabloda hatırlamaya dayanırdı;
  -- bunun yerine her turda her dolu tablo denenir, yabancı anahtar engeli
  -- olan bir sonraki tura kalır. İlerleme durursa işlem bütünüyle geri sarılır.
  loop
    tur := tur + 1;
    ilerledi := false;
    kalan := public.internal_organization_content_counts(target_organization_id);
    exit when kalan = '{}'::jsonb;

    for tablo in select jsonb_object_keys(kalan) loop
      begin
        execute format(
          'delete from public.%I where organization_id = $1', tablo
        ) using target_organization_id;
        get diagnostics silinen = row_count;
        if silinen > 0 then
          ilerledi := true;
        end if;
      exception when foreign_key_violation then
        null; -- bir sonraki turda yeniden denenir
      end;
    end loop;

    if not ilerledi or tur > 50 then
      raise exception 'Kurum boşaltılamadı: kayıtlar birbirini tutuyor.'
        using errcode = 'ORB04',
              detail = kalan::text;
    end if;
  end loop;

  -- Kurumun kendi denetim kaydı da kişi adları taşır; içerikle birlikte gider.
  -- Boşaltmanın izi platform denetim kaydında kalır (aşağıda).
  delete from public.audit_events as olay
  where olay.organization_id = target_organization_id;
  get diagnostics denetim = row_count;

  select coalesce(sum(value::bigint), 0) into toplam
  from jsonb_each_text(sayilar);

  insert into public.platform_audit_events (
    actor_user_id, action, entity_type, entity_id, organization_id, metadata
  )
  values (
    (select auth.uid()),
    'platform.organization_purged',
    'organization',
    kurum.id,
    kurum.id,
    jsonb_build_object(
      'organization_name', kurum.name,
      'organization_code', kurum.code,
      'closed_at', kurum.archived_at,
      'deleted', sayilar,
      'deleted_total', toplam,
      'deleted_audit_events', denetim
    )
  );

  return jsonb_build_object(
    'deleted', sayilar,
    'deleted_total', toplam,
    'deleted_audit_events', denetim
  );
end;
$$;

comment on function public.platform_purge_organization(uuid, integer) is
  'Kapatılmış ve bekleme süresi (30 gün) dolmuş kurumun bütün içeriğini ve kurum denetim kaydını siler; GERİ ALINAMAZ. Kurum kodu onay olarak istenir (22023). Kapalı değilse ORB02, süre dolmadıysa ORB03 (detail = boşaltılabileceği an). Hesaplar, üyelikler ve şubeler kalır; onları "Kurumu sil" kaldırır. Platform denetim kaydına tablo başına sayılarla yazar.';

revoke all on function public.platform_purge_organization(uuid, integer) from public, anon;
grant execute on function public.platform_purge_organization(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Gece işi: kapı defterinin eski satırları
-- ---------------------------------------------------------------------------
-- `internal_function_calls` her çağrıda yalnız çağıranın kendi 7 günden eski
-- satırlarını ayıklıyordu; bir daha hiç çağırmayan kullanıcının (örneğin
-- silinen kurumun yöneticisi) satırları kalıyordu. Ana plan 2.5 bunu
-- "kapı defterinin temizlenmesi" diye yazdı. Kurum silme fonksiyonuna
-- tanıtmak reddedilmişti (tablo kurum taşımıyor, 2026-09-07); gece işi
-- tablonun kendi süresini (7 gün) herkese uygular.
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

  ozet := jsonb_build_object(
    'messages', mesaj,
    'message_notifications', bildirim,
    'conversations', sohbet,
    'client_error_reports', hata,
    'email_deliveries', posta,
    'function_calls', defter
  );

  -- Bir şey silindiyse ne kadar silindiği kalıcı olarak yazılır (yalnız
  -- sayılar; içerik değil). Hiçbir şey silinmeyen gece satır yazmaz.
  if mesaj + bildirim + sohbet + hata + posta + defter > 0 then
    insert into public.platform_audit_events (actor_user_id, action, entity_type, metadata)
    values (null, 'platform.retention_purged', 'retention', ozet);
  end if;

  return ozet;
end;
$$;

revoke all on function public.internal_purge_expired_records()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Edge Function kapısı: kapalı kurumun çağıranı da kilitli
-- ---------------------------------------------------------------------------
-- Kapı `current_user_must_change_password()`'ı çağıramaz (servis rolüyle
-- koşuyor, `auth.uid()` boş); kendi ifadesine kapalı kurum eklendi. Cevap
-- aynı `password_locked`: Edge tarafı bilinmeyen bir cevabı reddeder ve yeni
-- bir neden yayın gerektirirdi. Kapalı kurumun kullanıcısı arayüzde zaten
-- "kurum kapatıldı" ekranında durur; bu cevabı ancak doğrudan API çağrısı görür.

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
  )
  -- Kapatılmış kurumun çağıranı da kilitli (2026-10-25, ana plan 2.5).
  or public.internal_user_in_closed_organization(
    internal_begin_function_call.caller_user_id
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
