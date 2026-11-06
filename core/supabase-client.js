// core/supabase-client.js
const SUPABASE_URL = 'https://wfpupolzgbglgmzjafge.supabase.co'; // URL ของโรงเรียนคุณครู
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // KEY เดิมของคุณครู

if (!window.supabaseClient) {
    const { createClient } = window.supabase;
    window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: false,   // ปิด Auto Refresh กันยิงซ้ำติด 401
            persistSession: true,
            detectSessionInUrl: false  // 👈 ปิดตัวนี้! เพื่อไม่ให้มันไปควานหา Token เก่าใน URL จนติด 401
        }
    });
}

window.db = window.supabaseClient;
