-- ALLOW-DESTRUCTIVE: `schedule_entries.room` metin kopyası kaldırılır. Göç 20261029000000'dan beri derslik adının asıl yeri `rooms` kaydı; bu sütun yalnız tetikleyiciyle tutulan bir kopyaydı ve göç 20261104000000 ile istemci ve `today_lessons` onu okumayı bıraktı (genişlet–daralt, ikinci adım). Kayıp yok: her dersin dersliği `room_id` ile duruyor.
--
-- Eski derslik metin kopyası kaldırılır (2026-10-15, ROADMAP v1.5-15'in kalanı).
--
-- Kopyayı derslik kaydıyla eşit tutan iki tetikleyici de gider:
--   `schedule_entries_room_name_follows` — ders yazılırken adı kopyalardı
--   `rooms_rename_follows` — derslik yeniden adlandırılınca bütün dersleri
--     güncellerdi
--
-- #466 (göç 20261104000000) 2026-10-14'te yayına çıktı; o sürümden önce
-- açılmış bir sekme `room` sütununu isteyebilirdi. Arada bir gün var ve
-- uygulama her yeni sürümde sayfayı tazeliyor.

drop trigger rooms_rename_follows on public.rooms;
drop function public.internal_room_rename_follows();

drop trigger schedule_entries_room_name_follows on public.schedule_entries;
drop function public.internal_schedule_room_name_follows();

alter table public.schedule_entries drop column room;
