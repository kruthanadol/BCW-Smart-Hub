// core/auth-manager.js
import { cleanStr } from './supabase-client.js';

// ดึงข้อมูล Session ปัจจุบัน (รองรับทั้ง Parent, Teacher, Student)
export function getSession(roleKey = 'parent_session') {
    try {
        const sessionStr = localStorage.getItem(roleKey) || sessionStorage.getItem(roleKey);
        if (!sessionStr) return null;
        return JSON.parse(sessionStr);
    } catch (e) {
        console.error('Error reading session:', e);
        return null;
    }
}

// ตรวจสอบสิทธิ์การเข้าใช้งาน (Auth Guard)
export function requireAuth(roleKey = 'parent_session', redirectUrl = '/login.html') {
    const session = getSession(roleKey);
    const userId = session && (session.student_id || session.teacher_id || session.user_id) 
        ? cleanStr(session.student_id || session.teacher_id || session.user_id) 
        : '';
    
    if (!userId) {
        alert('ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาล็อกอินใหม่อีกครั้ง');
        window.location.href = redirectUrl;
        return null;
    }
    return userId;
}

// ออกจากระบบและล้างค่า Session ทั้งหมด
export function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login.html';
}

window.logout = logout;