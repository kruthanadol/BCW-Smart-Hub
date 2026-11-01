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

    // ดึงค่าอย่างยืดหยุ่นไม่ว่าจะเก็บบันทึกด้วย Key ไหน
    const role = (localStorage.getItem('user_role') || localStorage.getItem('role') || '').toLowerCase().trim();
    const userId = localStorage.getItem('user_id') || localStorage.getItem('student_id') || localStorage.getItem('teacher_id');

    return {
        userId: userId,
        teacherId: localStorage.getItem('teacher_id') || userId,
        studentId: localStorage.getItem('student_id') || userId,
        name: localStorage.getItem('user_name') || 'ผู้ใช้งาน',
        email: localStorage.getItem('user_email') || '',
        role: role,
        avatar: localStorage.getItem('user_avatar') || ''
    };
}

export function requireAuth(allowedRoles = [], redirectUrl = '../../login.html') {
    const user = getCurrentUser();

    // 1. ถ้ายังไม่ได้ล็อกอิน ให้กลับไปหน้า login
    if (!user || !user.role) {
        console.warn('Auth Failed: No session found');
        window.location.replace(redirectUrl);
        return null;
    }

    const userRole = user.role.toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());

    // 2. สิทธิ์ระดับสูง (Admin / Executive / Superadmin) เข้าถึงได้ทุกหน้า
    const isPowerUser = ['admin', 'superadmin', 'super_admin', 'executive'].includes(userRole);

    // 3. ตรวจสอบสิทธิ์ถ้าไม่ตรงให้ปฏิเสธการเข้าถึง
    if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole) && !isPowerUser) {
        console.warn(`Auth Failed: Role ${userRole} not allowed in [${allowedRoles.join(', ')}]`);
        alert('🔒 คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
        window.location.replace(redirectUrl);
        return null;
    }

    return user;
}

export function logout(redirectUrl = '../../login.html') {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace(redirectUrl);
}
/**
 * ตรวจสอบสิทธิ์การเข้าใช้งานทั่วไป (Auth Guard สำหรับหน้า Portal ต่างๆ)
 * @param {Array<string>|string} allowedRoles - บทบาทที่อนุญาต เช่น ['teacher', 'admin']
 * @param {string} redirectUrl - หน้าที่จะส่งกลับกรณีไม่มีสิทธิ์
 * @returns {Object|null} คืนค่า Object ผู้ใช้งานหากได้รับอนุญาต
 */
export function requireAuth(allowedRoles = [], redirectUrl = '../../login.html') {
    const user = getCurrentUser();

    // 1. ถ้าไม่ได้ล็อกอิน ให้เคลียร์ Storage แล้วส่งกลับ Login ทันที
    if (!user || !user.isLoggedIn || !user.userId) {
        logout(redirectUrl);
        return null;
    }

    // 2. ถ้ามีการระบุสิทธิ์ (allowedRoles) ให้เช็กว่าผู้ใช้มีสิทธิ์ตรงหรือไม่
    if (allowedRoles && allowedRoles.length > 0) {
        const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        const hasPermission = rolesArray.some(r => r.toLowerCase() === user.role.toLowerCase());

        if (!hasPermission) {
            alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            redirectToUserPortal(user);
            return null;
        }
    }

    return user;
}

/**
 * ตัวตรวจสิทธิ์เฉพาะสำหรับหน้า landing.html (ป้องกัน Loop Redirect และสลับหน้าครู/Admin)
 */
export function checkLandingAccess() {
    const user = getCurrentUser();

    if (!user || !user.isLoggedIn) {
        window.location.replace('login.html');
        return null;
    }

    const role = user.role;

    // ถ้าเป็น นักเรียน หรือ ผู้ปกครอง พยายามเข้า Landing ➔ ให้ดีดกลับพอร์ตัลของตนเองทันที
    if (role === 'student') {
        window.location.replace('apps/student-app/student.html');
        return null;
    } else if (role === 'parent') {
        window.location.replace('apps/parent-app/parent.html');
        return null;
    }

    // ถ้าเป็น Admin, Executive, Super Admin หรือ Teacher อนุญาตให้อยู่หน้า landing.html ได้
    return user;
}

/**
 * ส่งผู้ใช้ไปยังพอร์ตัลประจำบทบาท (Direct Routing Helper)
 * @param {Object} user - ข้อมูลผู้ใช้จาก getCurrentUser()
 */
export function redirectToUserPortal(user) {
    if (!user || !user.role) {
        window.location.replace('login.html');
        return;
    }

    const role = user.role.toLowerCase();

    if (role === 'admin' || role === 'executive' || role === 'super_admin') {
        window.location.replace('landing.html');
    } else if (role === 'teacher') {
        window.location.replace('apps/school-app/teacher.html');
    } else if (role === 'student') {
        window.location.replace('apps/student-app/student.html');
    } else if (role === 'parent') {
        window.location.replace('apps/parent-app/parent.html');
    } else {
        window.location.replace('login.html');
    }
}

/**
 * ออกจากระบบ และล้างค่า Session ทั้งหมดอย่างปลอดภัย
 * @param {string} redirectUrl - หน้าที่จะส่งไปหลัง Logout
 */
export function logout(redirectUrl = 'login.html') {
    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch (e) {
        console.error('Logout error:', e);
    }
    window.location.replace(redirectUrl);
}

// ผูกฟังก์ชัน logout ไว้กับ window เพื่อให้กดปุ่ม ออกจากระบบ ใน HTML ได้ทันที
window.logout = logout;
window.logoutUser = logout;
