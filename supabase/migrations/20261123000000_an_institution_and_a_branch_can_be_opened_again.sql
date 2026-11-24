-- Kurum ve şube yeniden açılabilir (bulundu 2026-11-24, yerel tohum koşusunda).
--
-- 1. Kurum kurma, 5.5'ten (#503) beri reddediliyordu.
--
-- 5.5, kişi kodu tahsisine "açılmış ama üyeliği henüz yazılmamış hesap"
-- kuralını ekledi: tahsis → auth hesabı → üyelik sırasında aynı anda açılan
-- iki üye aynı kodu almasın diye `<kurum><kişi>@orbit.invalid` hesapları da
-- sayılıyor. Üye eklemede doğru; kurum kurmada yanlış:
--
--   bootstrap-organization (Edge)
--     1. yöneticinin hesabını açar: <kurum>1000@orbit.invalid
--     2. internal_bootstrap_organization(..., admin_person_code => 1000)
--        → internal_next_person_code adım 1'deki hesabı "uçuşta" sayar,
--          1001 bekler → 'person code mismatch' (23514) → kurulum geri alınır
--
-- Yani 5.5 birleştiğinden beri yeni kurum açılamıyordu. pgTAP bunu görmedi:
-- kurulum fonksiyonu yalnız yetki testlerinde çağrılıyordu, hiçbir test
-- Edge'in sırasıyla (önce hesap, sonra kurulum) uçtan uca kurmuyordu.
-- `person_code.test.sql` artık kuruyor.
--
-- Düzeltme: tahsis isteğe bağlı bir "bu hesabı sayma" parametresi alır.
-- Kurulum kendi açtığı yöneticinin hesabını dışarıda bırakır; başka bekleyen
-- hesaplar yine sayılır, yani 5.5'in yarış koruması olduğu gibi kalır. Üye
-- ekleme (`internal_allocate_member_slot`) tek argümanla çağırmayı sürdürür.
--
-- İmza değiştiği için eski fonksiyon kaldırılıp yeniden kurulur. Onu adıyla
-- çağıran plpgsql gövdeleri derleme anında bağlanmaz; varsayılan parametre
-- sayesinde tek argümanlı çağrılar aynı fonksiyona çözülür.

drop function public.internal_next_person_code(uuid);

create function public.internal_next_person_code(
  target_organization_id uuid,
  pending_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  kurum_kodu integer;
  next_code integer;
begin
  select kurum.code into kurum_kodu
  from public.organizations as kurum
  where kurum.id = target_organization_id
  for update;

  if not found then
    raise exception 'organization does not exist' using errcode = '23503';
  end if;

  -- Üyelikteki en büyük kod ve açılmış ama üyeliği henüz yazılmamış hesap
  -- (tahsis → auth hesabı → üyelik sırasının ortası). İkincisi olmadan aynı
  -- anda açılan iki üye aynı kodu alıyordu. `pending_user_id` çağıranın
  -- kendi açtığı hesaptır: onu saymak kodu kendi kendine bir ileri iterdi.
  select greatest(
    coalesce((
      select max(uyelik.person_code)
      from public.organization_memberships as uyelik
      where uyelik.organization_id = target_organization_id
    ), 999),
    coalesce((
      select max(substring(hesap.email from 5 for 4)::integer)
      from auth.users as hesap
      where hesap.email like kurum_kodu::text || '____@orbit.invalid'
        and substring(hesap.email from 5 for 4) ~ '^[0-9]{4}$'
        and hesap.id is distinct from pending_user_id
    ), 999)
  ) + 1
  into next_code;

  if next_code > 9999 then
    raise exception 'organization person code capacity exhausted'
      using errcode = '23514';
  end if;

  return next_code;
end;
$$;

comment on function public.internal_next_person_code(uuid, uuid) is
  'Kurumun sıradaki kişi kodu: üyeliklerdeki ve açılmış ama üyeliği yazılmamış <kurum><kişi>@orbit.invalid hesaplarındaki en büyük kod + 1. pending_user_id verilirse o hesap sayılmaz (kurulumun kendi açtığı yönetici). Yalnız service_role ve security definer fonksiyonlar çağırır.';

revoke all on function public.internal_next_person_code(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.internal_next_person_code(uuid, uuid) to service_role;

-- Kurulum: gövde 20260824180500 ile aynı; tek fark tahsisin yöneticinin
-- kendi hesabını saymaması.
create or replace function public.internal_bootstrap_organization(
  organization_name text,
  organization_slug text,
  organization_code integer,
  branch_name text,
  admin_user_id uuid,
  admin_person_code integer,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
  new_branch_id uuid;
  new_membership_id uuid;
  expected_person_code integer;
begin
  if not exists (select 1 from auth.users where id = admin_user_id) then
    raise exception 'admin user does not exist' using errcode = '23503';
  end if;

  insert into public.organizations (name, slug, code)
  values (
    trim(organization_name),
    lower(trim(organization_slug)),
    organization_code
  )
  returning id into new_organization_id;

  insert into public.branches (organization_id, name, is_default)
  values (new_organization_id, trim(branch_name), true)
  returning id into new_branch_id;

  -- Kişi kodunun tek doğruluk kaynağı veritabanıdır. Çağıran taraf da bir
  -- değer hesaplıyor (sentetik adresi kurabilmek için kullanıcıyı bu
  -- fonksiyondan ÖNCE yaratmak zorunda) ve iki hesap birbirini tutmalı.
  -- Yöneticinin o anda açılmış hesabı tahsiste sayılmaz (2026-11-24).
  expected_person_code :=
    public.internal_next_person_code(new_organization_id, admin_user_id);

  if expected_person_code is distinct from admin_person_code then
    raise exception
      'person code mismatch: caller sent %, database expects %',
      admin_person_code, expected_person_code
      using errcode = '23514';
  end if;

  insert into public.organization_memberships (
    organization_id,
    branch_id,
    user_id,
    role,
    status,
    person_code
  )
  values (
    new_organization_id,
    null,
    admin_user_id,
    'admin',
    'active',
    admin_person_code
  )
  returning id into new_membership_id;

  insert into public.audit_events (
    organization_id,
    branch_id,
    actor_user_id,
    action,
    entity_type,
    entity_id
  )
  values (
    new_organization_id,
    new_branch_id,
    actor_user_id,
    'organization.bootstrap',
    'organization',
    new_organization_id
  );

  return jsonb_build_object(
    'organization_id', new_organization_id,
    'organization_code', organization_code,
    'branch_id', new_branch_id,
    'membership_id', new_membership_id,
    'person_code', admin_person_code,
    'login_number', organization_code::text || admin_person_code::text
  );
end;
$$;

revoke all on function public.internal_bootstrap_organization(
  text, text, integer, text, uuid, integer, uuid
) from public, anon, authenticated;

grant execute on function public.internal_bootstrap_organization(
  text, text, integer, text, uuid, integer, uuid
) to service_role;

-- =========================================================================
-- 2. Yeni şube ekleyene geri döner (aynı tohum koşusunda bulundu)
-- =========================================================================
--
-- 5.1'den (#504) beri `branches_select_member` görünür şubeleri `branches`
-- tablosunu tarayarak sorgu başında bir kez sayıyordu. Arayüz şubeyi
-- `insert(...).select()` ile ekliyor (`branchService.createBranch`); yeni
-- satır o listede yok, RETURNING okuma kuralına takılıyor ve ekleme
-- "new row violates row-level security policy" ile geri alınıyordu.
--
-- Liste artık yalnız ÜYELİKLERDEN çıkar: kurum geneli üyelik kurumun her
-- şubesini `organization_id` ile, şubeli üyelik kendi şubesini `id` ile
-- görür. Görünürlük birebir aynı (`branch_insert_reads_back.test.sql` 3–5);
-- fark, aynı sorguda eklenen satırın da görünmesi. Dizi fonksiyonları yine
-- sorgu başına bir kez çalışır (5.1 kuralı).

create function public.current_user_org_wide_member_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct uyelik.organization_id), '{}'::uuid[])
  from public.organization_memberships as uyelik
  where uyelik.user_id = (select auth.uid())
    and uyelik.status = 'active'
    and uyelik.branch_id is null;
$$;

comment on function public.current_user_org_wide_member_org_ids() is
  'Çağıranın şubesiz (kurum geneli) aktif üyeliği olan kurumlar, rol fark etmeksizin. branches okuma kuralı sorgu başına bir kez çağırır.';

create function public.current_user_member_branch_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct uyelik.branch_id), '{}'::uuid[])
  from public.organization_memberships as uyelik
  where uyelik.user_id = (select auth.uid())
    and uyelik.status = 'active'
    and uyelik.branch_id is not null;
$$;

comment on function public.current_user_member_branch_ids() is
  'Çağıranın şubeli aktif üyeliklerinin şubeleri, rol fark etmeksizin. branches okuma kuralı sorgu başına bir kez çağırır.';

revoke all on function public.current_user_org_wide_member_org_ids() from public, anon;
revoke all on function public.current_user_member_branch_ids() from public, anon;
grant execute on function public.current_user_org_wide_member_org_ids() to authenticated, service_role;
grant execute on function public.current_user_member_branch_ids() to authenticated, service_role;

-- Kimlik okuması: kilitsiz kalır (password_lock_boundary'nin üç istisnasından biri).
alter policy branches_select_member on public.branches
  using (
    organization_id = any ((select public.current_user_org_wide_member_org_ids())::uuid[])
    or id = any ((select public.current_user_member_branch_ids())::uuid[])
  );

-- Artık hiçbir kural çağırmıyor.
drop function public.current_user_visible_branch_ids();
