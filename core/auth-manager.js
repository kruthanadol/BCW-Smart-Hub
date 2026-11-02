// core/auth-manager.js

/**
 * 1. อ่านข้อมูล Session ของผู้ใช้ปัจจุบันจาก LocalStorage / SessionStorage
 */
export function getCurrentUser() {
    // เช็ก Flag ว่าล็อกอินอยู่หรือไม่ (รองรับทั้งการเช็กตรงๆ และการเช็ก user_role/user_email)
    const isLoggedIn = localStorage.getItem('user_logged_in') === 'true' || 
                       sessionStorage.getItem('user_logged_in') === 'true' ||
                       !!localStorage.getItem('user_email');
    
    if (!isLoggedIn) return null;

    const role = (localStorage.getItem('user_role') || localStorage.getItem('role') || 'student').toLowerCase().trim();
    const userId = localStorage.getItem('user_id') || localStorage.getItem('teacher_id') || localStorage.getItem('student_id') || '';

    return {
        id: localStorage.getItem('user_uuid') || '',
        userId: userId,
        teacherId: localStorage.getItem('teacher_id') || userId,
        studentId: localStorage.getItem('student_id') || userId,
        name: localStorage.getItem('user_name') || 'ผู้ใช้งาน',
        email: localStorage.getItem('user_email') || '',
        role: role,
        avatar: localStorage.getItem('user_avatar') || 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
        classroom: localStorage.getItem('user_classroom') || ''
    };
}

/**
 * 2. Auth Guard เช็กสิทธิ์การเข้าถึงหน้าเว็บตาม Allowed Roles
 * (ปรับให้ Default Redirect กลับไปที่ login.html ใน Root)
 */
export function requireAuth(allowedRoles = [], redirectUrl = '/login.html') {
    const user = getCurrentUser();

    // กรณีไม่มี Session หรือไม่ได้ล็อกอิน
    if (!user || !user.role) {
        console.warn('🔒 Auth Guard: ไม่พบ Session การเข้าสู่ระบบ สั่ง Redirect ไปที่:', redirectUrl);
        window.location.replace(redirectUrl);
        return null;
    }

    // แปลงสิทธิ์เป็นตัวพิมพ์เล็กทั้งหมดเพื่อป้องกัน Case-sensitive mismatch
    const userRole = user.role.toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());
    
    // กำหนดกลุ่มผู้ใช้งานที่มีสิทธิ์เข้าถึงได้ทุกส่วน (Power Users)
    const isPowerUser = ['admin', 'superadmin', 'super_admin', 'executive'].includes(userRole);

    // ตรวจสอบสิทธิ์การเข้าถึง (หากไม่ได้กำหนด allowedRoles ไว้เลย จะถือว่าผ่านทุกคนที่ผ่านการล็อกอิน)
    if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole) && !isPowerUser) {
        console.error(`🔒 Auth Guard Error: บทบาท "${userRole}" ไม่มีสิทธิ์เข้าถึงหน้านี้`);
        alert('🔒 คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
        window.location.replace(redirectUrl);
        return null;
    }

    return user;
}

/**
 * 3. ฟังก์ชันออกจากระบบ ล้าง Storage ทั้งหมดและส่งกลับหน้า Login
 */
export function logout(redirectUrl = '/login.html') {
    console.log('🚪 กำลังออกจากระบบ และล้าง Session ทั้งหมด...');
    
    // หากมี AuthService อยู่ใน Window ให้เรียก SignOut จาก Supabase ด้วย
    if (window.AuthService && typeof window.AuthService.logout === 'function') {
        window.AuthService.logout();
        return;
    }

    localStorage.clear();
    sessionStorage.clear();
    window.location.replace(redirectUrl);
}

/**
 * 4. เช็กสถานะการล็อกอินแบบ Boolean (ใช้ตรวจสอบสั้นๆ ใน UI)
 */
export function isAuthenticated() {
    return getCurrentUser() !== null;
}

// ผูกฟังก์ชันเข้ากับ Global Window เพื่อให้ Event Handler เก่าๆ เรียกใช้งานได้
if (typeof window !== 'undefined') {
    window.getCurrentUser = getCurrentUser;
    window.requireAuth = requireAuth;
    window.logoutUser = logout;
    window.handleLogout = logout;
    window.isAuthenticated = isAuthenticated;
}
