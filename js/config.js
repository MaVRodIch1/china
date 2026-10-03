/* Настройки облачной синхронизации (Supabase).
 * Anon-ключ публичный по дизайну: данные защищены политиками RLS (см. supabase/schema.sql).
 * Оставьте поля пустыми, чтобы приложение работало только локально. */
window.HZ = window.HZ || {};
HZ.config = {
  supabaseUrl: '',      // например: https://abcdxyz.supabase.co
  supabaseAnonKey: ''   // Project Settings → API → anon public key
};
