// core/auth-manager.js
import { cleanStr } from './supabase-client.js';

/**
 * ดึงข้อมูลผู้ใช้งานปัจจุบันจาก Session/LocalStorage กลาง (Shared Context)
 * @returns {Object|null} ข้อมูลผู้ใช้ { userId, role, name, avatar, email, isLoggedIn }
 */
// core/auth-manager.js

// core/auth-manager.js

export function getCurrentUser() {
    const isLoggedIn = localStorage.getItem('user_logged_in') === 'true' || sessionStorage.getItem('user_logged_in') === 'true';
    if (!isLoggedIn) return null;

    const role = (localStorage.getItem('user_role') || localStorage.getItem('role') || '').toLowerCase().trim();
    const userId = localStorage.getItem('user_id') || localStorage.getItem('teacher_id') || localStorage.getItem('student_id') || '';

    return {
        id: localStorage.getItem('user_uuid') || '',
        userId: userId,
        teacherId: localStorage.getItem('teacher_id') || userId,
        studentId: localStorage.getItem('student_id') || userId,
        name: localStorage.getItem('user_name') || localStorage.getItem('full_name') || 'ผู้ใช้งาน',
        email: localStorage.getItem('user_email') || '',
        role: role,
        avatar: localStorage.getItem('user_avatar') || 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
        classroom: localStorage.getItem('user_classroom') || ''
    };
}

/**
 * Auth Guard ตรวจสอบสิทธิ์การเข้าถึงหน้าเว็บ
 * @param {Array<string>} allowedRoles - รายชื่อ Role ที่อนุญาต เช่น ['teacher', 'admin']
 * @param {string} redirectUrl - URL หน้าที่จะส่งกลับถ้าไม่มีสิทธิ์
 */
export function requireAuth(allowedRoles = [], redirectUrl = '../../login.html') {
    const user = getCurrentUser();

    if (!user || !user.role) {
        console.warn('Auth Guard Warning: ไม่พบ Session ผู้ใช้งาน เตะกลับหน้า Login');
        window.location.replace(redirectUrl);
        return null;
    }

    const userRole = user.role.toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());
    
    // ผู้มีสิทธิ์ระดับสูงเข้าถึงได้ทุกหน้า
    const isPowerUser = ['admin', 'superadmin', 'super_admin', 'executive'].includes(userRole);

    if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole) && !isPowerUser) {
        alert('🔒 คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
        window.location.replace(redirectUrl);
        return null;
    }

    return user;
}

/**
 * ฟังก์ชันออกจากระบบแบบเด็ดขาด ล้าง Storage ทุกประเภท
 */
export function logout(redirectUrl = '../../login.html') {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace(redirectUrl);
}

// ผูกฟังก์ชันเข้ากับ window object เพื่อรองรับการเรียกใช้จาก inline event เก่าๆ
if (typeof window !== 'undefined') {
    window.logoutUser = logout;
    window.handleLogout = logout;
}
