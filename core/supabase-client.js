// core/supabase-client.js
const SUPABASE_URL = 'https://wfpopolzgxbglgmzjafg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcG9wb2x6Z3hiZ2xnbXpqYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDg3MDUsImV4cCI6MjEwNDc4NDcwNX0.bU4l7Pn965id_moYgiQqk4tB6zBL-PNeIcdScNxzyKk';

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
