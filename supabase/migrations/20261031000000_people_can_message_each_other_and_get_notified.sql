-- ALLOW-DESTRUCTIVE: göç hiçbir şey silmez; "delete from" yalnız mark_notifications_read fonksiyonunun gövdesinde, kullanıcının KENDİ 90 günden eski OKUNMUŞ bildirimlerini temizleyen satırdır (KVKK: veri en az).
-- Uygulama içi mesajlaşma ve bildirimler (2026-10-12, kullanıcı kararları).
--
-- Kararlar (bu oturumda soruldu ve cevaplandı):
--   * Kim kime: öğrenci ve veli ↔ öğretmen ve yönetim. Öğretmen yalnız
--     okuttuğu sınıfların öğrencilerine ve velilerine; yönetici herkese.
--     Personel kendi arasında yazışabilir. Öğrenci–veli, veli–veli yok.
--   * Biçim: kişiyle birebir sohbet (aynı iki kişi arasında tek konuşma).
--   * Zil: yeni mesaj, duyuru, ödev, sınav sonucu, devamsızlık.
--   * Pilotta bildirim yalnız uygulama içi (karar 2026-09-16); e-posta ayrı iş.
--
-- Gizlilik: bir konuşmayı yalnız iki tarafı görür — kurum yöneticisi
-- başkalarının yazışmasını OKUYAMAZ. Tablolara doğrudan yazma yetkisi yok;
-- her şey aşağıdaki fonksiyonlardan geçer ve "kim kime" kuralı her mesajda
-- yeniden denetlenir (öğretmen sınıftan ayrılınca o velilere yazamaz).
--
-- Canlı güncelleme: bildirim kişiye özel `user:<kullanıcı>` kanalına dürtme
-- gönderir; kurum kanalına değil (bir mesaj bütün kurumu tazelemesin).

-- 1. Tablolar -----------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Birebir: iki üyelik, küçük olan önce (aynı çift tek konuşma).
  member_low uuid not null references public.organization_memberships(id) on delete cascade,
  member_high uuid not null references public.organization_memberships(id) on delete cascade,
  low_read_at timestamptz,
  high_read_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_pair_check check (member_low < member_high),
  constraint conversations_pair_key unique (organization_id, member_low, member_high)
);
create index conversations_member_low_idx on public.conversations (member_low, last_message_at desc);
create index conversations_member_high_idx on public.conversations (member_high, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_check check (char_length(btrim(body)) between 1 and 2000)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc, id desc);
create index messages_organization_idx on public.messages (organization_id);
create index messages_sender_idx on public.messages (sender_membership_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  -- Tıklanınca açılacak sekme (ör. "Ödevler") ve ilgili kayıt.
  section text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_kind_check
    check (kind in ('message', 'announcement', 'homework', 'exam_result', 'attendance'))
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_organization_idx on public.notifications (organization_id);
-- Okunmamış aynı bildirim ikinci kez yazılmaz (ör. sınav sonucu yeniden kaydedildi).
create unique index notifications_unread_once_idx
  on public.notifications (user_id, kind, entity_id)
  where read_at is null and entity_id is not null;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

revoke all on public.conversations, public.messages, public.notifications from anon, authenticated;
grant select on public.conversations, public.messages, public.notifications to authenticated;

-- 2. Kim kime yazabilir ----------------------------------------------------------

-- Bir üyeliğin bugün okuttuğu sınıflar: atama, rehberlik ve bugün süren vekillik.
create function public.internal_membership_class_ids(target_membership_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct sinif_id), '{}'::uuid[])
  from (
    select atama.class_id as sinif_id
    from public.class_teachers as atama
    where atama.membership_id = target_membership_id and atama.archived_at is null
    union
    select sinif.id
    from public.classes as sinif
    where sinif.mentor_membership_id = target_membership_id and sinif.archived_at is null
    union
    select atama.class_id
    from public.substitute_assignments as vekil
    join public.class_teachers as atama
      on atama.membership_id = vekil.absent_membership_id and atama.archived_at is null
    where vekil.substitute_membership_id = target_membership_id
      and vekil.archived_at is null
      and (select public.orbit_today()) between vekil.starts_on and vekil.ends_on
    union
    select sinif.id
    from public.substitute_assignments as vekil
    join public.classes as sinif
      on sinif.mentor_membership_id = vekil.absent_membership_id and sinif.archived_at is null
    where vekil.substitute_membership_id = target_membership_id
      and vekil.archived_at is null
      and (select public.orbit_today()) between vekil.starts_on and vekil.ends_on
  ) as kaynak;
$$;

-- Öğrenci ya da veli üyeliğinin etkin sınıf kayıtlarının sınıfları.
create function public.internal_family_class_ids(target_membership_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct kayit.class_id), '{}'::uuid[])
  from public.organization_memberships as uyelik
  join public.students as ogrenci
    on ogrenci.organization_id = uyelik.organization_id
   and ogrenci.archived_at is null
   and (
     (uyelik.role = 'student' and ogrenci.auth_user_id = uyelik.user_id)
     or (uyelik.role = 'parent' and exists (
       select 1
       from public.student_guardians as bag
       join public.guardians as veli on veli.id = bag.guardian_id
       where bag.student_id = ogrenci.id
         and bag.archived_at is null
         and veli.archived_at is null
         and veli.auth_user_id = uyelik.user_id
     ))
   )
  join public.class_enrollments as kayit
    on kayit.student_id = ogrenci.id and kayit.archived_at is null
  where uyelik.id = target_membership_id;
$$;

create function public.internal_can_message(from_membership_id uuid, to_membership_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ben public.organization_memberships;
  o public.organization_memberships;
  ogretmen uuid;
  aile uuid;
begin
  if from_membership_id = to_membership_id then
    return false;
  end if;
  select * into ben from public.organization_memberships where id = from_membership_id;
  select * into o from public.organization_memberships where id = to_membership_id;
  if ben.id is null or o.id is null
     or ben.status <> 'active' or o.status <> 'active'
     or ben.organization_id <> o.organization_id then
    return false;
  end if;

  -- Personel kendi arasında; yönetici herkesle.
  if ben.role in ('admin', 'teacher') and o.role in ('admin', 'teacher') then
    return true;
  end if;
  if ben.role = 'admin' or o.role = 'admin' then
    return true;
  end if;
  -- Öğrenci–veli, veli–veli, öğrenci–öğrenci yok.
  if ben.role not in ('admin', 'teacher') and o.role not in ('admin', 'teacher') then
    return false;
  end if;

  -- Öğretmen ↔ öğrenci/veli: öğretmen ailenin bir sınıfını okutuyor.
  if ben.role = 'teacher' then
    ogretmen := ben.id; aile := o.id;
  else
    ogretmen := o.id; aile := ben.id;
  end if;
  return public.internal_membership_class_ids(ogretmen) && public.internal_family_class_ids(aile);
end;
$$;

-- Çağıranın kurumdaki etkin üyeliği (bir hesap tek kuruma aittir).
create function public.internal_my_membership_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select uyelik.id
  from public.organization_memberships as uyelik
  where uyelik.user_id = (select auth.uid()) and uyelik.status = 'active'
  order by uyelik.created_at
  limit 1;
$$;

-- 3. Okuma kuralları ------------------------------------------------------------

create policy conversations_select_participant
  on public.conversations for select to authenticated
  using (
    (member_low = (select public.internal_my_membership_id())
     or member_high = (select public.internal_my_membership_id()))
    and not (select public.current_user_must_change_password())
  );

create policy messages_select_participant
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations as konusma
      where konusma.id = messages.conversation_id
        and (konusma.member_low = (select public.internal_my_membership_id())
             or konusma.member_high = (select public.internal_my_membership_id()))
    )
    and not (select public.current_user_must_change_password())
  );

create policy notifications_select_own
  on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid())
    and not (select public.current_user_must_change_password())
  );

-- Kişiye özel kanal: yalnız kendi `user:<id>` konusunu dinler.
create policy "kullanici kendi kanalini dinler"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );

-- 4. Bildirim yazımı ------------------------------------------------------------

create function public.internal_notify(
  target_user_ids uuid[],
  target_organization_id uuid,
  target_kind text,
  target_title text,
  target_body text,
  target_section text,
  target_entity_id uuid,
  except_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  kisi uuid;
begin
  insert into public.notifications (organization_id, user_id, kind, title, body, section, entity_id)
  select target_organization_id, alici, target_kind, left(target_title, 160),
         left(target_body, 200), target_section, target_entity_id
  from (select distinct unnest(target_user_ids) as alici) as alicilar
  where alici is not null and alici is distinct from except_user_id
  on conflict (user_id, kind, entity_id) where read_at is null and entity_id is not null
  do nothing;

  -- Kişiye özel dürtme; veri taşımaz, istemci kendi bildirimlerini okur.
  foreach kisi in array coalesce(target_user_ids, '{}'::uuid[]) loop
    if kisi is not null and kisi is distinct from except_user_id then
      perform realtime.send(
        jsonb_build_object('kind', target_kind), 'notify', 'user:' || kisi::text, true);
    end if;
  end loop;
end;
$$;

-- Bir sınıfın öğrencileri (giriş hesabı olanlar) ve velileri.
create function public.internal_class_family_user_ids(target_class_id uuid, include_students boolean)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct kisi), '{}'::uuid[])
  from (
    select ogrenci.auth_user_id as kisi
    from public.class_enrollments as kayit
    join public.students as ogrenci on ogrenci.id = kayit.student_id and ogrenci.archived_at is null
    where kayit.class_id = target_class_id and kayit.archived_at is null and include_students
    union
    select veli.auth_user_id
    from public.class_enrollments as kayit
    join public.student_guardians as bag on bag.student_id = kayit.student_id and bag.archived_at is null
    join public.guardians as veli on veli.id = bag.guardian_id and veli.archived_at is null
    where kayit.class_id = target_class_id and kayit.archived_at is null
  ) as kaynak
  where kisi is not null;
$$;

-- Bir öğrencinin kendisi ve velileri.
create function public.internal_student_family_user_ids(target_student_id uuid, include_student boolean)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct kisi), '{}'::uuid[])
  from (
    select ogrenci.auth_user_id as kisi
    from public.students as ogrenci
    where ogrenci.id = target_student_id and include_student
    union
    select veli.auth_user_id
    from public.student_guardians as bag
    join public.guardians as veli on veli.id = bag.guardian_id and veli.archived_at is null
    where bag.student_id = target_student_id and bag.archived_at is null
  ) as kaynak
  where kisi is not null;
$$;

-- Duyuru: görebilecek herkese (kitle kuralının birebir aynısı), yazan hariç.
create function public.internal_notify_feed_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  alicilar uuid[];
  yazan uuid;
begin
  if new.archived_at is not null then
    return null;
  end if;
  select uyelik.user_id into yazan
  from public.organization_memberships as uyelik where uyelik.id = new.author_membership_id;

  select coalesce(array_agg(distinct uyelik.user_id), '{}'::uuid[]) into alicilar
  from public.organization_memberships as uyelik
  where uyelik.organization_id = new.organization_id
    and uyelik.status = 'active'
    and (
      uyelik.role in ('admin', 'teacher')
      or new.audience = 'all'
      or (new.audience = 'guardians' and uyelik.role = 'parent')
      or (new.audience = 'students' and uyelik.role = 'student')
    )
    and (
      new.class_id is null
      or uyelik.role = 'admin'
      or (uyelik.role = 'teacher' and new.class_id = any (public.internal_membership_class_ids(uyelik.id)))
      or (uyelik.role in ('student', 'parent') and new.class_id = any (public.internal_family_class_ids(uyelik.id)))
    );

  perform public.internal_notify(
    alicilar, new.organization_id, 'announcement', new.title,
    left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 200),
    'İletişim', new.id, yazan);
  return null;
end;
$$;

create trigger daily_feed_posts_notify
  after insert on public.daily_feed_posts
  for each row execute function public.internal_notify_feed_post();

-- Ödev: sınıfın öğrencileri ve velileri.
create function public.internal_notify_homework()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is not null then
    return null;
  end if;
  perform public.internal_notify(
    public.internal_class_family_user_ids(new.class_id, true),
    new.organization_id, 'homework', 'Yeni ödev: ' || new.title,
    'Son gün ' || to_char(new.due_date, 'DD.MM.YYYY') || '.',
    'Ödevler', new.id);
  return null;
end;
$$;

create trigger homework_assignments_notify
  after insert on public.homework_assignments
  for each row execute function public.internal_notify_homework();

-- Sınav sonucu: öğrenci ve velileri; aynı sınav için okunmamış tek bildirim.
create function public.internal_notify_exam_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sinav_id uuid;
  ogrenci_id uuid;
  sinav_adi text;
  kurum uuid;
begin
  if tg_table_name = 'exam_section_results' then
    select bolum.exam_id into sinav_id from public.exam_sections as bolum where bolum.id = new.section_id;
  else
    sinav_id := new.exam_id;
  end if;
  ogrenci_id := new.student_id;
  select sinav.name, sinav.organization_id into sinav_adi, kurum
  from public.exams as sinav where sinav.id = sinav_id;
  if kurum is null then
    return null;
  end if;
  perform public.internal_notify(
    public.internal_student_family_user_ids(ogrenci_id, true),
    kurum, 'exam_result', 'Sınav sonucu girildi: ' || sinav_adi, null,
    'Sınavlar', sinav_id);
  return null;
end;
$$;

create trigger exam_results_notify
  after insert on public.exam_results
  for each row execute function public.internal_notify_exam_result();
create trigger exam_section_results_notify
  after insert on public.exam_section_results
  for each row execute function public.internal_notify_exam_result();

-- Devamsızlık: yalnız velilere; gelmedi ya da geç kaldı işaretlenince.
create function public.internal_notify_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ogrenci_adi text;
  tarih date;
begin
  if new.status not in ('absent', 'late')
     or (tg_op = 'UPDATE' and old.status = new.status) then
    return null;
  end if;
  select ogrenci.full_name into ogrenci_adi from public.students as ogrenci where ogrenci.id = new.student_id;
  select oturum.session_date into tarih from public.attendance_sessions as oturum where oturum.id = new.session_id;
  perform public.internal_notify(
    public.internal_student_family_user_ids(new.student_id, false),
    new.organization_id, 'attendance',
    ogrenci_adi || case when new.status = 'absent' then ' derse gelmedi' else ' derse geç kaldı' end,
    to_char(tarih, 'DD.MM.YYYY') || ' tarihli yoklama.',
    'Yoklama', new.id);
  return null;
end;
$$;

create trigger attendance_records_notify
  after insert or update of status on public.attendance_records
  for each row execute function public.internal_notify_attendance();

-- 5. Mesajlaşma fonksiyonları ----------------------------------------------------

-- Yazabileceğim kişiler (ad, rol ve bir satırlık bağlam).
create function public.list_message_contacts()
returns table (membership_id uuid, display_name text, role public.app_role, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  with ben as (
    select uyelik.* from public.organization_memberships as uyelik
    where uyelik.id = (select public.internal_my_membership_id())
  )
  select
    o.id,
    coalesce(nullif(btrim(profil.display_name), ''), 'Adsız üye'),
    o.role,
    case o.role
      when 'admin' then 'Kurum yönetimi'
      when 'teacher' then 'Öğretmen'
      when 'student' then (
        select string_agg(distinct sinif.name, ', ')
        from public.classes as sinif
        where sinif.id = any (public.internal_family_class_ids(o.id)))
      when 'parent' then (
        select 'Velisi: ' || string_agg(distinct ogrenci.full_name, ', ')
        from public.guardians as veli
        join public.student_guardians as bag on bag.guardian_id = veli.id and bag.archived_at is null
        join public.students as ogrenci on ogrenci.id = bag.student_id and ogrenci.archived_at is null
        where veli.auth_user_id = o.user_id and veli.organization_id = o.organization_id
          and veli.archived_at is null)
    end
  from ben
  join public.organization_memberships as o
    on o.organization_id = ben.organization_id and o.status = 'active' and o.id <> ben.id
  join public.profiles as profil on profil.id = o.user_id
  where not (select public.current_user_must_change_password())
    and public.internal_can_message(ben.id, o.id)
  order by 2;
$$;

-- Konuşmalarım: karşı taraf, son mesaj, okunmamış mı.
create function public.list_conversations()
returns table (
  conversation_id uuid,
  other_membership_id uuid,
  other_name text,
  other_role public.app_role,
  last_message text,
  last_message_at timestamptz,
  last_from_me boolean,
  unread boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with ben as (select (select public.internal_my_membership_id()) as id)
  select
    konusma.id,
    karsi.id,
    coalesce(nullif(btrim(profil.display_name), ''), 'Adsız üye'),
    karsi.role,
    son.body,
    konusma.last_message_at,
    son.sender_membership_id = ben.id,
    son.sender_membership_id <> ben.id
      and son.created_at > coalesce(
        case when konusma.member_low = ben.id then konusma.low_read_at else konusma.high_read_at end,
        '-infinity'::timestamptz)
  from ben
  join public.conversations as konusma
    on konusma.member_low = ben.id or konusma.member_high = ben.id
  join public.organization_memberships as karsi
    on karsi.id = case when konusma.member_low = ben.id then konusma.member_high else konusma.member_low end
  join public.profiles as profil on profil.id = karsi.user_id
  left join lateral (
    select mesaj.body, mesaj.sender_membership_id, mesaj.created_at
    from public.messages as mesaj
    where mesaj.conversation_id = konusma.id
    order by mesaj.created_at desc, mesaj.id desc
    limit 1
  ) as son on true
  where not (select public.current_user_must_change_password())
    and konusma.last_message_at is not null
  order by konusma.last_message_at desc
  limit 200;
$$;

-- Konuşmayı aç (yoksa kur) ve kimliğini döndür.
create function public.start_conversation(target_membership_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ben uuid := public.internal_my_membership_id();
  kurum uuid;
  kimlik uuid;
begin
  if ben is null or (select public.current_user_must_change_password()) then
    raise exception 'Bu işlem için oturum açmanız gerekiyor.' using errcode = '42501';
  end if;
  if not public.internal_can_message(ben, target_membership_id) then
    raise exception 'Bu kişiye mesaj gönderemezsiniz.'
      using errcode = '42501',
            hint = 'Öğretmenler yalnız okuttukları sınıfların öğrencilerine ve velilerine yazabilir.';
  end if;
  select organization_id into kurum from public.organization_memberships where id = ben;

  insert into public.conversations (organization_id, member_low, member_high)
  values (kurum, least(ben, target_membership_id), greatest(ben, target_membership_id))
  on conflict (organization_id, member_low, member_high) do nothing;

  select konusma.id into kimlik
  from public.conversations as konusma
  where konusma.organization_id = kurum
    and konusma.member_low = least(ben, target_membership_id)
    and konusma.member_high = greatest(ben, target_membership_id);
  return kimlik;
end;
$$;

create function public.send_message(target_conversation_id uuid, message_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ben uuid := public.internal_my_membership_id();
  konusma public.conversations;
  karsi uuid;
  karsi_kullanici uuid;
  benim_adim text;
  kimlik uuid;
begin
  if ben is null or (select public.current_user_must_change_password()) then
    raise exception 'Bu işlem için oturum açmanız gerekiyor.' using errcode = '42501';
  end if;
  -- Kötüye kullanım sınırı: dakikada en çok 30 mesaj.
  if (select count(*) from public.messages as mesaj
       where mesaj.sender_membership_id = ben
         and mesaj.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Çok hızlı mesaj gönderiyorsunuz; bir dakika sonra tekrar deneyin.'
      using errcode = '54000';
  end if;

  select * into konusma from public.conversations where id = target_conversation_id;
  if konusma.id is null or ben not in (konusma.member_low, konusma.member_high) then
    raise exception 'Konuşma bulunamadı.' using errcode = 'P0002';
  end if;
  karsi := case when konusma.member_low = ben then konusma.member_high else konusma.member_low end;
  if not public.internal_can_message(ben, karsi) then
    raise exception 'Bu kişiye artık mesaj gönderemezsiniz.'
      using errcode = '42501',
            hint = 'Öğretmen sınıftan ayrıldıysa ya da üyelik kapatıldıysa yazışma yalnız okunur.';
  end if;
  if message_body is null or char_length(btrim(message_body)) = 0 then
    raise exception 'Boş mesaj gönderilemez.' using errcode = '22023';
  end if;
  if char_length(btrim(message_body)) > 2000 then
    raise exception 'Mesaj en çok 2000 karakter olabilir.' using errcode = '22023';
  end if;

  insert into public.messages (organization_id, conversation_id, sender_membership_id, body)
  values (konusma.organization_id, konusma.id, ben, btrim(message_body))
  returning id into kimlik;

  update public.conversations
     set last_message_at = now(),
         low_read_at = case when member_low = ben then now() else low_read_at end,
         high_read_at = case when member_high = ben then now() else high_read_at end
   where id = konusma.id;

  select uyelik.user_id into karsi_kullanici from public.organization_memberships as uyelik where uyelik.id = karsi;
  select coalesce(nullif(btrim(profil.display_name), ''), 'Bir üye') into benim_adim
  from public.organization_memberships as uyelik
  join public.profiles as profil on profil.id = uyelik.user_id
  where uyelik.id = ben;

  -- Konuşma başına okunmamış tek mesaj bildirimi (sohbet akmaya devam eder).
  perform public.internal_notify(
    array[karsi_kullanici], konusma.organization_id, 'message',
    benim_adim || ' size yazdı',
    left(regexp_replace(btrim(message_body), '\s+', ' ', 'g'), 120),
    'İletişim', konusma.id);
  return kimlik;
end;
$$;

create function public.mark_conversation_read(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ben uuid := public.internal_my_membership_id();
begin
  update public.conversations
     set low_read_at = case when member_low = ben then now() else low_read_at end,
         high_read_at = case when member_high = ben then now() else high_read_at end
   where id = target_conversation_id and ben in (member_low, member_high);
  update public.notifications
     set read_at = now()
   where user_id = (select auth.uid()) and kind = 'message'
     and entity_id = target_conversation_id and read_at is null;
end;
$$;

-- Bildirimleri okundu işaretle: verilen kimlikler ya da hepsi (null).
create function public.mark_notifications_read(target_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  adet integer;
begin
  update public.notifications
     set read_at = now()
   where user_id = (select auth.uid())
     and read_at is null
     and (target_ids is null or id = any (target_ids));
  get diagnostics adet = row_count;
  -- 90 günden eski okunmuş bildirimler tutulmaz (veri en az, KVKK).
  delete from public.notifications
   where user_id = (select auth.uid())
     and read_at is not null
     and created_at < now() - interval '90 days';
  return adet;
end;
$$;

-- 6. Yetkiler -------------------------------------------------------------------

revoke all on function public.internal_membership_class_ids(uuid) from public, anon, authenticated;
revoke all on function public.internal_family_class_ids(uuid) from public, anon, authenticated;
revoke all on function public.internal_can_message(uuid, uuid) from public, anon, authenticated;
revoke all on function public.internal_notify(uuid[], uuid, text, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.internal_class_family_user_ids(uuid, boolean) from public, anon, authenticated;
revoke all on function public.internal_student_family_user_ids(uuid, boolean) from public, anon, authenticated;
revoke all on function public.internal_notify_feed_post() from public, anon, authenticated;
revoke all on function public.internal_notify_homework() from public, anon, authenticated;
revoke all on function public.internal_notify_exam_result() from public, anon, authenticated;
revoke all on function public.internal_notify_attendance() from public, anon, authenticated;

revoke all on function public.internal_my_membership_id() from public, anon;
grant execute on function public.internal_my_membership_id() to authenticated;

revoke all on function public.list_message_contacts() from public, anon;
revoke all on function public.list_conversations() from public, anon;
revoke all on function public.start_conversation(uuid) from public, anon;
revoke all on function public.send_message(uuid, text) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.list_message_contacts() to authenticated;
grant execute on function public.list_conversations() to authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
