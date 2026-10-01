/**
 * Edge Function bağımlılıklarının tek kaynağı (#215, **K-06**).
 *
 * Edge Function'lar Deno ortamında çalışır ve bağımlılıklarını `npm:`
 * protokolüyle çeker. Bağımlılıkların satır içi (inline) her dosyada ayrı ayrı
 * sabitlenmesi, sürümlerin istemci paketlerinden sessizce ayrışmasına ve 70
 * minor boyunca güncellenmeden donmasına yol açtı.
 *
 * Bu modül, Edge Function'ların kullandığı tüm harici paket sürümlerini tek bir
 * noktada toplar ve `package.json`'daki istemci sürümleriyle birebir eşitler.
 * `supabase/tests/deployment/edgeDependencyPins.test.ts` testi, buradaki
 * sürümlerin `package.json` ile senkronize kaldığını ve hiçbir fonksiyonda satır
 * içi `npm:` importu bulunmadığını zorunlu kılar (**K-19**).
 */

export {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.117.2";
export { z } from "npm:zod@4.6.5";
