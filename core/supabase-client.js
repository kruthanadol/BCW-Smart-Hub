// core/supabase-client.js
const SUPABASE_URL = 'https://wfpopolzgxbglgmzjafg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcG9wb2x6Z3hiZ2xnbXpqYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDg3MDUsImV4cCI6MjEwNDc4NDcwNX0.bU4l7Pn965id_moYgiQqk4tB6zBL-PNeIcdScNxzyKk';

// สร้าง Client และผูกเข้ากับ window เพื่อให้เรียกใช้ได้ทั่วทั้งระบบ ( Global Access )
if (typeof supabase !== 'undefined' && supabase.createClient) {
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.db = window.supabase; // รองรับโค้ดเดิมที่ใช้ชื่อ db
} else {
    console.error('Supabase SDK ยังไม่ได้ถูกดึงเข้ามาในหน้าเว็บ');
}

// Utility Normalizers
window.cleanStr = (val) => String(val || '').trim();
window.cleanLower = (val) => String(val || '').trim().toLowerCase();
