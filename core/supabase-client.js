// core/supabase-client.js
const SUPABASE_URL = 'https://wfpopolzgxbglgmzjafg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcG9wb2x6Z3hiZ2xnbXpqYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDg3MDUsImV4cCI6MjEwNDc4NDcwNX0.bU4l7Pn965id_moYgiQqk4tB6zBL-PNeIcdScNxzyKk';

if (!window.supabaseClient) {
    const supabaseLib = window.supabase;

    if (!supabaseLib || typeof supabaseLib.createClient !== 'function') {
        console.error('❌ ไม่พบ Supabase SDK CDN กรุณาตรวจสอบแท็ก script ใน HTML');
    } else {
        window.supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
    }
}

window.db = window.supabaseClient;
