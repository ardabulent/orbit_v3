-- Derslik bir kayıttır; aynı saatte iki derse verilemez (2026-10-12, ROADMAP v1.5-15).
--
-- Karar 2026-09-16 ("Derslik bir varlıktır; çakışma serbest metinle değil
-- kimlikle engellenir"): `schedule_entries.room` serbest metindi ve "A-101"
-- ile "A101" ayrı yer sayılıyordu. Öğretmen ve sınıf çakışması şemada zaten
-- engelliydi; derslik değildi.
--
-- 1. `rooms` tablosu: kurumun derslikleri. "Paylaşılabilir" derslik (Online,
--    Bahçe, Konferans salonu) çakışma kuralının dışında kalır.
-- 2. `schedule_entries.room_id`: dersin dersliği.
-- 3. Çakışma: aynı derslik, aynı gün, SÜRESİ kesişen iki etkin ders olamaz
--    (10:00–10:50 ile 10:30–11:20 da çakışır; öğretmen/sınıf indeksleri yalnız
--    aynı başlangıcı yakalıyor). Engellenince sebep söylenir: hangi sınıfın
--    dersi, hangi saatte (karar: "engellendiğinde sebebi söylenmeli").
--
-- ⚠️ GENİŞLET–DARALT: `schedule_entries.room` metin sütunu bu göçte
-- DÜŞÜRÜLMEZ. Göç birleşir birleşmez uygulanır, ama açık tarayıcı sekmeleri
-- eski uygulamayla o sütunu okumaya devam eder; düşürülseydi yenilenene kadar
-- ders programı ve iki "bugünkü dersler" fonksiyonu kırılırdı. Sütun artık
-- yazılamaz (yetkisi geri alındı) ve tetikleyiciyle `rooms.name`'den doldurulur:
-- tek kaynak `room_id`. Düşürülmesi ayrı bir göçün işi (ROADMAP v1.5-15).

-- 1. Derslikler ----------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  shareable boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_name_check check (char_length(btrim(name)) between 1 and 60),
  constraint rooms_id_organization_key unique (id, organization_id)
);

comment on table public.rooms is
  'Kurumun derslikleri (v1.5-15). shareable: aynı saatte birden çok derse verilebilir (Online, Bahçe).';

create unique index rooms_organization_name_idx
  on public.rooms (organization_id, lower(btrim(name)))
  where archived_at is null;
create index rooms_organization_idx on public.rooms (organization_id, archived_at);

alter table public.rooms enable row level security;

create policy rooms_select_member
  on public.rooms for select to authenticated
  using (
    organization_id = any ((select public.current_user_member_org_ids())::uuid[])
    and not (select public.current_user_must_change_password())
  );

create policy rooms_insert_admin
  on public.rooms for insert to authenticated
  with check (
    public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
    and not (select public.current_user_must_change_password())
  );

create policy rooms_update_admin
  on public.rooms for update to authenticated
  using (
    public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
    and not (select public.current_user_must_change_password())
  )
  with check (
    public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
    and not (select public.current_user_must_change_password())
  );

revoke all on public.rooms from anon, authenticated;
grant select on public.rooms to authenticated;
grant insert (organization_id, name, shareable) on public.rooms to authenticated;
grant update (name, shareable, archived_at) on public.rooms to authenticated;

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();
create trigger rooms_audit_insert
  after insert on public.rooms
  for each row execute function public.audit_row_change('room', 'name', 'shareable');
create trigger rooms_audit_update
  after update on public.rooms
  for each row execute function public.audit_row_change('room', 'name', 'shareable');
create trigger rooms_broadcast_insert
  after insert on public.rooms referencing new table as changed_rows
  for each statement execute function public.broadcast_organization_change();
create trigger rooms_broadcast_update
  after update on public.rooms referencing new table as changed_rows
  for each statement execute function public.broadcast_organization_change();
create trigger rooms_broadcast_delete
  after delete on public.rooms referencing old table as changed_rows
  for each statement execute function public.broadcast_organization_change();

-- 2. Dersin dersliği -----------------------------------------------------------
alter table public.schedule_entries add column room_id uuid;
alter table public.schedule_entries
  add constraint schedule_entries_room_fkey
  foreign key (room_id, organization_id)
  references public.rooms (id, organization_id);
create index schedule_entries_room_idx
  on public.schedule_entries (room_id, day_of_week, starts_at)
  where room_id is not null and archived_at is null;

-- Var olan serbest metinler dersliğe dönüşür (büyük/küçük harf ve kenar
-- boşluğu farkı tek derslik sayılır). "Online" gibi adlar paylaşılabilir
-- başlar; gerisi değil — aynı saatte iki derse yazılmış eski bir satır, ancak
-- düzenlenmek istendiğinde uyarı verir, şimdi silinmez.
insert into public.rooms (organization_id, name, shareable)
select organization_id,
       min(btrim(room)),
       lower(min(btrim(room))) in ('online', 'çevrimiçi', 'uzaktan', 'uzaktan eğitim')
from public.schedule_entries
where room is not null and btrim(room) <> ''
group by organization_id, lower(btrim(room));

update public.schedule_entries as satir
   set room_id = derslik.id
  from public.rooms as derslik
 where derslik.organization_id = satir.organization_id
   and lower(btrim(derslik.name)) = lower(btrim(satir.room))
   and satir.room is not null;

-- Metin sütunu artık yalnız okunur: kaynak room_id.
revoke insert (room), update (room) on public.schedule_entries from authenticated;
grant insert (room_id), update (room_id) on public.schedule_entries to authenticated;

create function public.internal_schedule_room_name_follows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.room_id is null then
    new.room := null;
  else
    select derslik.name into new.room
    from public.rooms as derslik
    where derslik.id = new.room_id;
  end if;
  return new;
end;
$$;

comment on function public.internal_schedule_room_name_follows() is
  'schedule_entries.room (eski metin sütunu) room_id''den doldurulur; genişlet–daralt geçişi (v1.5-15).';

create trigger schedule_entries_room_name_follows
  before insert or update of room_id, room on public.schedule_entries
  for each row execute function public.internal_schedule_room_name_follows();

create function public.internal_room_rename_follows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.schedule_entries
     set room = new.name
   where room_id = new.id
     and room is distinct from new.name;
  return null;
end;
$$;

create trigger rooms_rename_follows
  after update of name on public.rooms
  for each row execute function public.internal_room_rename_follows();

-- Denetim izi artık dersliği kimliğiyle izler (metin kopyası her yeniden
-- adlandırmada bütün derslere iz düşürürdü).
drop trigger schedule_entries_audit_insert on public.schedule_entries;
drop trigger schedule_entries_audit_update on public.schedule_entries;
create trigger schedule_entries_audit_insert
  after insert on public.schedule_entries
  for each row execute function public.audit_row_change(
    'schedule_entry', 'class_id', 'membership_id', 'subject_id', 'day_of_week', 'starts_at', 'room_id');
create trigger schedule_entries_audit_update
  after update on public.schedule_entries
  for each row execute function public.audit_row_change(
    'schedule_entry', 'class_id', 'membership_id', 'subject_id', 'day_of_week', 'starts_at', 'room_id');

-- 3. Çakışma -------------------------------------------------------------------
-- Ders aralığı dakika olarak; bitişi yazılmamış ders tek dakikalık sayılır
-- (yalnız aynı başlangıçla çakışır, öğretmen/sınıf kuralıyla aynı).
create function public.internal_lesson_minutes(starts time, ends time)
returns int4range
language sql
immutable
set search_path = ''
as $$
  select int4range(
    (extract(epoch from starts) / 60)::int,
    coalesce((extract(epoch from ends) / 60)::int, (extract(epoch from starts) / 60)::int + 1)
  );
$$;

create function public.internal_room_conflict_text(
  target_room_id uuid,
  target_day smallint,
  target_starts time,
  target_ends time,
  except_entry_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select format(
           '%s bu saatte dolu: %s günü %s–%s arası %s dersi var.',
           derslik.name,
           (array['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'])[diger.day_of_week],
           to_char(diger.starts_at, 'HH24:MI'),
           coalesce(to_char(diger.ends_at, 'HH24:MI'), '?'),
           sinif.name || coalesce(' · ' || coalesce(ders.name, diger.title), '')
         )
  from public.schedule_entries as diger
  join public.rooms as derslik on derslik.id = diger.room_id
  join public.classes as sinif on sinif.id = diger.class_id
  left join public.subjects as ders on ders.id = diger.subject_id
  where diger.room_id = target_room_id
    and diger.day_of_week = target_day
    and diger.archived_at is null
    and diger.id is distinct from except_entry_id
    and public.internal_lesson_minutes(diger.starts_at, diger.ends_at)
        && public.internal_lesson_minutes(target_starts, target_ends)
  order by diger.starts_at
  limit 1;
$$;

create function public.enforce_room_is_free()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  paylasilir boolean;
  cakisma text;
begin
  if new.room_id is null or new.archived_at is not null then
    return new;
  end if;

  select derslik.shareable into paylasilir
  from public.rooms as derslik
  where derslik.id = new.room_id;
  if paylasilir then
    return new;
  end if;

  -- Aynı dersliğe aynı anda iki yazma birbirini görmeden geçmesin.
  perform pg_advisory_xact_lock(hashtextextended('orbit-room:' || new.room_id::text, 0));

  cakisma := public.internal_room_conflict_text(
    new.room_id, new.day_of_week, new.starts_at, new.ends_at, new.id);
  if cakisma is not null then
    raise exception '%', cakisma
      using errcode = 'ORB07',
            hint = 'Başka bir derslik seçin ya da dersin saatini değiştirin. Aynı saatte birden çok derse açık bir yerse (Online, Bahçe) dersliği "paylaşılabilir" yapın.';
  end if;
  return new;
end;
$$;

create trigger schedule_entries_room_is_free
  before insert or update of room_id, day_of_week, starts_at, ends_at, archived_at
  on public.schedule_entries
  for each row execute function public.enforce_room_is_free();

-- Derslik paylaşılabilirken çakışan dersler yazılmış olabilir: paylaşım
-- kapatılırken onlar söylenir. Kullanımdaki derslik kapatılamaz (ders gibi).
create function public.enforce_room_change_is_safe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cakisma text;
  kullanim bigint;
begin
  if new.archived_at is not null and old.archived_at is null then
    select count(*) into kullanim
    from public.schedule_entries as satir
    where satir.room_id = new.id and satir.archived_at is null;
    if kullanim > 0 then
      raise exception 'Bu derslik kapatılamaz: ders programında % derste kullanılıyor.', kullanim
        using errcode = 'ORB03',
              hint = 'Önce bu dersliği kullanan derslere başka bir derslik seçin.';
    end if;
  end if;

  if old.shareable and not new.shareable then
    select public.internal_room_conflict_text(
             satir.room_id, satir.day_of_week, satir.starts_at, satir.ends_at, satir.id)
      into cakisma
    from public.schedule_entries as satir
    where satir.room_id = new.id and satir.archived_at is null
      and public.internal_room_conflict_text(
            satir.room_id, satir.day_of_week, satir.starts_at, satir.ends_at, satir.id) is not null
    limit 1;
    if cakisma is not null then
      raise exception 'Paylaşım kapatılamaz — %', cakisma
        using errcode = 'ORB07',
              hint = 'Önce aynı saatteki derslerden birini başka dersliğe alın.';
    end if;
  end if;
  return new;
end;
$$;

create trigger rooms_change_is_safe
  before update of archived_at, shareable on public.rooms
  for each row execute function public.enforce_room_change_is_safe();

revoke all on function public.internal_schedule_room_name_follows() from public, anon, authenticated;
revoke all on function public.internal_room_rename_follows() from public, anon, authenticated;
revoke all on function public.internal_room_conflict_text(uuid, smallint, time, time, uuid) from public, anon, authenticated;
revoke all on function public.enforce_room_is_free() from public, anon, authenticated;
revoke all on function public.enforce_room_change_is_safe() from public, anon, authenticated;
revoke all on function public.internal_lesson_minutes(time, time) from public, anon;
