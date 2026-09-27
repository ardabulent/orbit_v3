-- Görev, sahibinin koyduğu sütunda durur.
--
-- =========================================================================
-- Neden gerekti
-- =========================================================================
--
-- Gün Planı panosunun dört sütunu (Planla · Bugün · Odaklan · Tamamlandı)
-- bugüne kadar görevin TARİHİNDEN hesaplanıyordu: tamamlandıysa Tamamlandı,
-- günü geçtiyse Odaklan, bugünse Bugün, değilse Planla. Kullanıcı bir görevi
-- "öne almak" için Odaklan'a koyamıyordu; "Odaklan" aslında "gecikmiş"
-- demekti ve o sütunun "+" düğmesi hiçbir işe yaramıyordu (ROADMAP §4.23
-- **C-10**).
--
-- Karar (2026-09-27, Arda Bülent): pano, MoneyFlow'daki gibi **elle** yönetilir.
-- Kişi görevin sütununu kendisi seçer; öncelik, etiket, saat ve tahmini süre
-- verir. Gecikmiş bir görev kendi sütununda kalır, ekran yalnız üstüne
-- "Gecikti" yazar — sistem kullanıcının seçimini değiştirmez.
--
-- =========================================================================
-- Beş alan
-- =========================================================================
--
-- `status`             planned · today · focus · done   (varsayılan planned)
-- `priority`           low · normal · high               (varsayılan normal)
-- `label`              attendance · parent_meeting · exam · homework ·
--                      report · enrollment · other      (boş olabilir)
-- `due_time`           saat, isteğe bağlı
-- `estimated_minutes`  tahmini süre, 1–600 dakika, isteğe bağlı
--
-- Enum tipi değil `text` + `check`: değer kümesi değişirse `alter type`
-- yerine bir kısıt değişir ve düz Postgres dışında hiçbir şeye bağlı kalmaz
-- (AGENTS.md kısıt 6). Etiket listesi bilerek **sabit**: serbest yazıda aynı
-- şey zamanla üç ayrı biçimde yazılır ve süzgeç işe yaramaz (karar 2026-09-27).
--
-- =========================================================================
-- `status` ile `completed_at` birbirine kilitli
-- =========================================================================
--
-- İki alan aynı olguyu anlatıyor; iki yerde tutulan durumun biri eskir
-- (**K-06**). `completed_at` silinmiyor çünkü raporlar ve "ne zaman bitti"
-- sorusu ona bakıyor. Bunun yerine:
--
--   1. Tetikleyici: `status` değişirse `completed_at` ondan türetilir;
--      yalnız `completed_at` değişirse (eski istemci yolu) `status` ondan
--      türetilir. Yeniden açılan görev **Bugün**'e döner.
--   2. Kısıt: `(status = 'done') = (completed_at is not null)`. Tetikleyici
--      bir gün yanlış yazılsa bile tutarsız satır yazılamaz.
--
-- =========================================================================
-- Mevcut görevler nereye gider
-- =========================================================================
--
-- Hiçbir görev ekranda yer değiştirmez: bugün hangi sütunda görünüyorsa oraya
-- yazılır. Tamamlanmış → done · günü geçmiş → focus · bugün → today ·
-- diğerleri → planned. Ölçüldü (2026-09-28): üretimde tek görev var ve
-- tamamlanmış, yani `done`'a gidiyor; kural yine de her durum için yazıldı.
--
-- Yetki değişmiyor: politikalar sahiplik üzerinden ve yeni alanları da
-- kapsıyor. Yalnız sütun yetkileri genişliyor.

alter table public.tasks
  add column status text not null default 'planned',
  add column priority text not null default 'normal',
  add column label text,
  add column due_time time,
  add column estimated_minutes smallint;

update public.tasks
set status = case
  when completed_at is not null then 'done'
  when due_on < public.orbit_today() then 'focus'
  when due_on = public.orbit_today() then 'today'
  else 'planned'
end;

alter table public.tasks
  add constraint tasks_status_check
    check (status in ('planned', 'today', 'focus', 'done')),
  add constraint tasks_priority_check
    check (priority in ('low', 'normal', 'high')),
  add constraint tasks_label_check
    check (label is null or label in (
      'attendance', 'parent_meeting', 'exam', 'homework',
      'report', 'enrollment', 'other'
    )),
  add constraint tasks_estimated_minutes_check
    check (estimated_minutes is null or estimated_minutes between 1 and 600),
  add constraint tasks_status_matches_completion_check
    check ((status = 'done') = (completed_at is not null));

comment on column public.tasks.status is
  'Panodaki sütun; sahibi elle seçer: planned · today · focus · done. `completed_at` ile kilitli (tetikleyici + kısıt). Tarihten türetilmez: gecikmiş görev kendi sütununda kalır, ekran yalnız "Gecikti" yazar.';
comment on column public.tasks.priority is 'low · normal · high.';
comment on column public.tasks.label is
  'Sabit etiket listesi: attendance · parent_meeting · exam · homework · report · enrollment · other. Boş olabilir.';
comment on column public.tasks.due_time is 'Görevin saati; isteğe bağlı.';
comment on column public.tasks.estimated_minutes is 'Tahmini süre, dakika (1–600); isteğe bağlı.';

create or replace function public.tasks_sync_status_and_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, now());
    elsif new.completed_at is not null then
      new.status := 'done';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    new.completed_at := case
      when new.status = 'done' then coalesce(new.completed_at, now())
    end;
  elsif new.completed_at is distinct from old.completed_at then
    -- Yalnız `completed_at` değişti (eski istemci yolu).
    new.status := case
      when new.completed_at is not null then 'done'
      else 'today'
    end;
  end if;

  return new;
end;
$$;

comment on function public.tasks_sync_status_and_completion() is
  'Görevin `status` ve `completed_at` alanlarını birbirine kilitler: status değişirse completed_at ondan, yalnız completed_at değişirse status ondan türetilir. Yeniden açılan görev today''e döner.';

revoke all on function public.tasks_sync_status_and_completion() from public, anon, authenticated;

create trigger tasks_sync_status_and_completion
before insert or update on public.tasks
for each row
execute function public.tasks_sync_status_and_completion();

grant insert (status, priority, label, due_time, estimated_minutes)
  on public.tasks to authenticated;
grant update (status, priority, label, due_time, estimated_minutes)
  on public.tasks to authenticated;
