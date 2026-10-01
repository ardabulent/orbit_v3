-- Bir hafta bir kez çizilir, birçok sınıfa verilir.
--
-- Kullanıcı geri bildirimi (2026-09-30): "ders programı ekle butonuna basarak
-- sadece bir ders ekleyebiliyoruz, komple tüm haftanın ders programı
-- eklenmiyor … ders programı oluşturma ve sınıflara atama şeklinde kurarsak
-- daha iyi olur." Kararlar (2026-10-01, Arda Bülent):
--
--   * Haftalık ŞABLON (gün × ders saati) bir kez doldurulur; tek seferde
--     birden çok sınıfa ATANIR.
--   * Atama bir KOPYADIR: şablon sonradan değişse sınıfların programı
--     değişmez; sınıf bazındaki düzeltmeler korunur.
--   * Atamada sınıfın mevcut programı için seçim: "replace" (eskiler
--     ARŞİVLENİR, silinmez) ya da "fill" (yalnız boş saatler doldurulur).
--   * Öğretmen sınıfın ders–öğretmen eşleşmesinden (`class_teachers`) gelir.
--     Eşleşme yoksa ya da öğretmen o saatte başka sınıfta dersteyse ders
--     ÖĞRETMENSİZ eklenir ve sonuçta "açıkta kalanlar" olarak listelenir.
--     Ekran kaydetmeden önce ön izlemeyle (`p_dry_run`) bunu gösterir ve
--     onay ister ("açıkta dersler kaldı, emin misiniz?").
--   * Şablon silinebilir (arşiv), sınıfın programı tamamen temizlenebilir.
--
-- Yetki: şablonlar yalnız kurum yöneticisinindir (okuma dahil). Atama ve
-- temizleme `security invoker`; yazmaları `schedule_entries_*` yönetici
-- politikaları süzer. Ön izleme yazmadığı için baştaki açık yönetici
-- kontrolü güvenlik sınırıdır.

-- ---------------------------------------------------------------------------
-- 1. Tablolar
-- ---------------------------------------------------------------------------
create table public.schedule_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null
    check (char_length(btrim(name)) between 1 and 120),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.schedule_template_slots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid not null,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  starts_at time not null,
  ends_at time,
  subject_id uuid not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  foreign key (template_id, organization_id)
    references public.schedule_templates (id, organization_id) on delete restrict,
  foreign key (subject_id, organization_id)
    references public.subjects (id, organization_id) on delete restrict
);

create unique index schedule_template_slots_slot_idx
  on public.schedule_template_slots (template_id, day_of_week, starts_at)
  where archived_at is null;
create index schedule_templates_organization_idx
  on public.schedule_templates (organization_id) where archived_at is null;

create trigger schedule_templates_set_updated_at
  before update on public.schedule_templates
  for each row execute function public.set_updated_at();
create trigger schedule_template_slots_set_updated_at
  before update on public.schedule_template_slots
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Yetki: yalnız kurum yöneticisi; ilk giriş kilidi her politikada
-- ---------------------------------------------------------------------------
alter table public.schedule_templates enable row level security;
alter table public.schedule_template_slots enable row level security;

revoke all on public.schedule_templates from anon, authenticated;
revoke all on public.schedule_template_slots from anon, authenticated;
grant select on public.schedule_templates to authenticated;
grant select on public.schedule_template_slots to authenticated;
grant insert (organization_id, name) on public.schedule_templates to authenticated;
grant update (name, archived_at) on public.schedule_templates to authenticated;
grant insert (organization_id, template_id, day_of_week, starts_at, ends_at, subject_id)
  on public.schedule_template_slots to authenticated;
grant update (archived_at) on public.schedule_template_slots to authenticated;

create policy schedule_templates_select_admin on public.schedule_templates
for select to authenticated
using (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);
create policy schedule_templates_insert_admin on public.schedule_templates
for insert to authenticated
with check (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);
create policy schedule_templates_update_admin on public.schedule_templates
for update to authenticated
using (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
)
with check (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);

create policy schedule_template_slots_select_admin on public.schedule_template_slots
for select to authenticated
using (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);
create policy schedule_template_slots_insert_admin on public.schedule_template_slots
for insert to authenticated
with check (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);
create policy schedule_template_slots_update_admin on public.schedule_template_slots
for update to authenticated
using (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
)
with check (
  public.current_user_has_membership(organization_id, null, array['admin']::public.app_role[])
  and not (select public.current_user_must_change_password())
);

-- Her yazma iz bırakır (every_write_leaves_a_trace kapısı).
create trigger schedule_templates_audit_insert
  after insert on public.schedule_templates
  for each row execute function public.audit_row_change('schedule_template', 'name');
create trigger schedule_templates_audit_update
  after update on public.schedule_templates
  for each row execute function public.audit_row_change('schedule_template', 'name');
create trigger schedule_template_slots_audit_insert
  after insert on public.schedule_template_slots
  for each row execute function public.audit_row_change(
    'schedule_template_slot', 'template_id', 'day_of_week', 'starts_at', 'subject_id');
create trigger schedule_template_slots_audit_update
  after update on public.schedule_template_slots
  for each row execute function public.audit_row_change(
    'schedule_template_slot', 'template_id', 'day_of_week', 'starts_at', 'subject_id');

-- ---------------------------------------------------------------------------
-- 3. Şablonu kaydet: ad + bütün kutular tek işlemde
-- ---------------------------------------------------------------------------
create function public.save_schedule_template(
  p_organization_id uuid,
  p_template_id uuid,
  p_name text,
  p_slots jsonb
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  sablon uuid := p_template_id;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then
    raise exception 'Şablon adı 1 ile 120 karakter arasında olmalı'
      using errcode = '22023';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array'
     or jsonb_array_length(p_slots) > 200 then
    raise exception 'Şablonda en çok 200 ders olabilir' using errcode = '22023';
  end if;
  if exists (
    select (t ->> 'day_of_week'), (t ->> 'starts_at')
      from jsonb_array_elements(p_slots) as e(t)
     group by 1, 2 having count(*) > 1
  ) then
    raise exception 'Aynı gün ve saatte iki ders olamaz' using errcode = '22023';
  end if;

  if sablon is null then
    insert into public.schedule_templates (organization_id, name)
    values (p_organization_id, btrim(p_name))
    returning id into sablon;
  else
    update public.schedule_templates
       set name = btrim(p_name)
     where id = sablon
       and organization_id = p_organization_id
       and archived_at is null;
    if not found then
      raise exception 'Şablon bulunamadı' using errcode = 'P0002';
    end if;
    update public.schedule_template_slots
       set archived_at = now()
     where template_id = sablon and archived_at is null;
  end if;

  insert into public.schedule_template_slots (
    organization_id, template_id, day_of_week, starts_at, ends_at, subject_id
  )
  select
    p_organization_id,
    sablon,
    (t ->> 'day_of_week')::smallint,
    (t ->> 'starts_at')::time,
    nullif(t ->> 'ends_at', '')::time,
    (t ->> 'subject_id')::uuid
  from jsonb_array_elements(p_slots) as e(t);

  return sablon;
end;
$$;

comment on function public.save_schedule_template(uuid, uuid, text, jsonb) is
  'Haftalık şablonu (ad + gün × saat ders kutuları) tek işlemde yazar; düzenlemede eski kutular arşivlenir. Aynı gün ve saatte iki ders 22023. security invoker: yönetici politikaları süzer.';

revoke all on function public.save_schedule_template(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.save_schedule_template(uuid, uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Şablonu sınıflara ata (ön izleme ya da kayıt)
-- ---------------------------------------------------------------------------
create function public.apply_schedule_template(
  p_template_id uuid,
  p_class_ids uuid[],
  p_mode text,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  kurum uuid;
  sinif record;
  kutu record;
  ogretmen uuid;
  eklenen integer;
  arsivlenen integer;
  atlanan integer;
  ozet jsonb := '[]'::jsonb;
  acikta jsonb := '[]'::jsonb;
begin
  select t.organization_id into kurum
    from public.schedule_templates as t
   where t.id = p_template_id and t.archived_at is null;
  if kurum is null then
    raise exception 'Şablon bulunamadı' using errcode = 'P0002';
  end if;
  if not (
    public.current_user_has_membership(kurum, null, array['admin']::public.app_role[])
    and not public.current_user_must_change_password()
  ) then
    raise exception 'Şablonu yalnız kurum yöneticisi atayabilir' using errcode = '42501';
  end if;
  if p_mode is null or p_mode not in ('replace', 'fill') then
    raise exception 'Atama biçimi replace ya da fill olmalı' using errcode = '22023';
  end if;
  if p_class_ids is null or cardinality(p_class_ids) = 0 then
    raise exception 'En az bir sınıf seçilmeli' using errcode = '22023';
  end if;

  begin
    for sinif in
      select s.id, s.name
        from public.classes as s
       where s.id = any(p_class_ids)
         and s.organization_id = kurum
         and s.archived_at is null
       order by s.name
    loop
      eklenen := 0;
      arsivlenen := 0;
      atlanan := 0;

      if p_mode = 'replace' then
        update public.schedule_entries
           set archived_at = now()
         where class_id = sinif.id and archived_at is null;
        get diagnostics arsivlenen = row_count;
      end if;

      for kutu in
        select k.day_of_week, k.starts_at, k.ends_at, k.subject_id, d.name as ders
          from public.schedule_template_slots as k
          join public.subjects as d on d.id = k.subject_id
         where k.template_id = p_template_id and k.archived_at is null
         order by k.day_of_week, k.starts_at
      loop
        if exists (
          select 1 from public.schedule_entries as e
           where e.class_id = sinif.id
             and e.day_of_week = kutu.day_of_week
             and e.starts_at = kutu.starts_at
             and e.archived_at is null
        ) then
          atlanan := atlanan + 1;
          continue;
        end if;

        select ct.membership_id into ogretmen
          from public.class_teachers as ct
         where ct.class_id = sinif.id
           and ct.subject_id = kutu.subject_id
           and ct.archived_at is null
         order by ct.created_at
         limit 1;

        if ogretmen is null then
          acikta := acikta || jsonb_build_object(
            'class_name', sinif.name, 'day_of_week', kutu.day_of_week,
            'starts_at', to_char(kutu.starts_at, 'HH24:MI'),
            'subject_name', kutu.ders, 'reason', 'no_teacher');
        elsif exists (
          select 1 from public.schedule_entries as e
           where e.membership_id = ogretmen
             and e.day_of_week = kutu.day_of_week
             and e.starts_at = kutu.starts_at
             and e.archived_at is null
        ) then
          acikta := acikta || jsonb_build_object(
            'class_name', sinif.name, 'day_of_week', kutu.day_of_week,
            'starts_at', to_char(kutu.starts_at, 'HH24:MI'),
            'subject_name', kutu.ders, 'reason', 'teacher_busy');
          ogretmen := null;
        end if;

        insert into public.schedule_entries (
          organization_id, class_id, subject_id, membership_id,
          day_of_week, starts_at, ends_at
        )
        values (
          kurum, sinif.id, kutu.subject_id, ogretmen,
          kutu.day_of_week, kutu.starts_at, kutu.ends_at
        );
        eklenen := eklenen + 1;
      end loop;

      ozet := ozet || jsonb_build_object(
        'class_id', sinif.id, 'class_name', sinif.name,
        'added', eklenen, 'archived', arsivlenen, 'skipped', atlanan);
    end loop;

    if p_dry_run then
      -- Ön izleme: hesaplanan özet döner, yazılanların hepsi geri alınır.
      raise exception using errcode = 'P0001', message = 'orbit_dry_run';
    end if;
  exception
    when raise_exception then
      if sqlerrm <> 'orbit_dry_run' then
        raise;
      end if;
  end;

  return jsonb_build_object(
    'saved', not p_dry_run,
    'classes', ozet,
    'unassigned', acikta
  );
end;
$$;

comment on function public.apply_schedule_template(uuid, uuid[], text, boolean) is
  'Şablonu seçili sınıflara KOPYALAR (2026-10-01). replace: sınıfın etkin programı arşivlenir; fill: yalnız boş saatler. Öğretmen class_teachers eşleşmesinden; eşleşme yoksa ya da öğretmen o saatte doluysa ders öğretmensiz eklenir ve unassigned listesinde döner. p_dry_run = true ön izlemedir: aynı hesap yapılır, hiçbir şey kalmaz. security invoker + açık yönetici kontrolü.';

revoke all on function public.apply_schedule_template(uuid, uuid[], text, boolean) from public, anon;
grant execute on function public.apply_schedule_template(uuid, uuid[], text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Sınıfın programını temizle
-- ---------------------------------------------------------------------------
create function public.clear_class_schedule(p_class_id uuid)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  adet integer;
begin
  update public.schedule_entries
     set archived_at = now()
   where class_id = p_class_id and archived_at is null;
  get diagnostics adet = row_count;
  return adet;
end;
$$;

comment on function public.clear_class_schedule(uuid) is
  'Sınıfın etkin bütün program satırlarını arşivler (silmez); arşivlenen sayıyı döner. security invoker: schedule_entries_update_admin süzer — yönetici değilse hiçbir satır etkilenmez (0).';

revoke all on function public.clear_class_schedule(uuid) from public, anon;
grant execute on function public.clear_class_schedule(uuid) to authenticated;
