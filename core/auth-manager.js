// core/auth-manager.js
import { cleanStr } from './supabase-client.js';

/**
 * ดึงข้อมูลผู้ใช้งานปัจจุบันจาก Session/LocalStorage กลาง (Shared Context)
 * @returns {Object|null} ข้อมูลผู้ใช้ { userId, role, name, avatar, email, isLoggedIn }
 */
export function getCurrentUser() {
    try {
        const isLoggedIn = localStorage.getItem('user_logged_in') === 'true' || 
                           sessionStorage.getItem('user_logged_in') === 'true';

        if (!isLoggedIn) return null;

        const role = localStorage.getItem('user_role') || localStorage.getItem('role') || '';
        const userId = cleanStr(localStorage.getItem('user_id') || localStorage.getItem('teacher_id') || localStorage.getItem('student_id') || '');
        const name = localStorage.getItem('user_name') || '';
        const avatar = localStorage.getItem('user_avatar') || '';
        const email = localStorage.getItem('user_email') || '';

        // Default SVG Avatar มาตรฐานเมื่อผู้ใช้ไม่มีรูปใน DB
        const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e1"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

        return {
            userId: userId,
            role: role.toLowerCase().trim(),
            name: name,
            avatar: avatar || defaultAvatar,
            email: email,
            isLoggedIn: true
        };
    } catch (e) {
        console.error('Error reading current user session:', e);
        return null;
    }
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
