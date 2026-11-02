// core/supabase-client.js
const SUPABASE_URL = 'https://wfpopolzgxbglgmzjafg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1...';

if (typeof supabase !== 'undefined' && supabase.createClient) {
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.db = window.supabase;
} else {
    console.error('Supabase SDK ยังไม่ได้ถูกดึงเข้ามาในหน้าเว็บ');
}

window.cleanStr = (val) => String(val || '').trim();
window.cleanLower = (val) => String(val || '').trim().toLowerCase();
