// Supabase Client для браузера
// ВАЖНО: Используй только publishable/anon ключ, НЕ используй secret/service_role ключи!

const SUPABASE_URL = 'https://pjumbkwtctxpacocjzjy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sBGhfrN_YM5uopNlghs1gQ_s5GYeBLU';

// Проверка, что ключи установлены
if (SUPABASE_URL === 'PASTE_YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'PASTE_YOUR_SUPABASE_ANON_KEY') {
    console.warn('⚠️ Supabase ключи не установлены! Установи SUPABASE_URL и SUPABASE_ANON_KEY в supabaseClient.js');
}

// Создаём глобальный клиент Supabase
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

