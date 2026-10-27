import { db } from './supabase-client.js';

/**
 * 🔍 1. ฟังก์ชันตรวจสอบบทบาท (Role Detection) จาก Input (ID หรือ Email)
 */
export async function identifyUserRole(inputIdentifier, password = '') {
    const cleanInput = inputIdentifier.trim().toLowerCase();
    
    // A. เช็กว่าเป็นครูหรือไม่ (ไอดีขึ้นต้นด้วย T หรือใช้อีเมลครู)
    if (cleanInput.startsWith('t') || cleanInput.includes('kru') || cleanInput.includes('teacher')) {
        // ค้นหาในตาราง teachers
        try {
            const { data, error } = await db.from('teachers')
                .select('*')
                .or(`teacher_id.ilike.${cleanInput},email.ilike.${cleanInput}`)
                .maybeSingle();
                
            if (data) {
                return { role: 'teacher', userData: data, redirectUrl: 'apps/school-app/teacher.html' };
            }
        } catch (e) {
            console.error('Teacher lookup error:', e);
        }
    }

    // B. เช็กว่าเป็นนักเรียนหรือผู้ปกครอง (รหัสนักเรียนเป็นตัวเลข 5 หลัก)
    try {
        const { data: student, error } = await db.from('students')
            .select('*')
            .or(`student_id.eq.${cleanInput},email.ilike.${cleanInput}`)
            .maybeSingle();

        if (student) {
            // เช็กว่าเป็นผู้ปกครองเข้าใช้งานหรือไม่ (ถ้ามี flag หรือ password ผู้ปกครอง)
            if (password && student.parent_password && password === student.parent_password) {
                return { role: 'parent', userData: student, redirectUrl: 'apps/parent-app/parent.html' };
            }
            return { role: 'student', userData: student, redirectUrl: 'apps/student-app/student.html' };
        }
    } catch (e) {
        console.error('Student lookup error:', e);
    }

    return { role: null, userData: null, redirectUrl: null };
}

/**
 * 💾 2. บันทึก Session ลง LocalStorage แบบเป็นมาตรฐานเดียวกันทั้งระบบ
 */
export function saveUserSession(role, userData) {
    localStorage.clear(); // ล้าง Session เก่าก่อนบันทึกใหม่
    
    localStorage.setItem('user_role', role);
    localStorage.setItem('user_logged_in', 'true');

    if (role === 'teacher') {
        localStorage.setItem('teacher_id', userData.teacher_id);
        localStorage.setItem('teacher_email', userData.email || '');
        localStorage.setItem('user_name', `${userData.prefix || ''}${userData.first_name} ${userData.last_name}`);
    } else if (role === 'student' || role === 'parent') {
        localStorage.setItem('student_id', userData.student_id);
        localStorage.setItem('student_email', userData.email || '');
        localStorage.setItem('student_class', userData.classroom || userData.class || '');
        localStorage.setItem('user_name', `${userData.prefix || ''}${userData.first_name} ${userData.last_name}`);
    }
}

/**
 * 🔒 3. ฟังก์ชันดักตรวจการเข้าถึงหน้า (ใช้ใส่ไว้ในแต่ละหน้าเพื่อป้องกันคนพิมพ์ URL เข้ามาตรงๆ)
 */
export function protectPage(allowedRoles = []) {
    const role = localStorage.getItem('user_role');
    const isLoggedIn = localStorage.getItem('user_logged_in') === 'true';

    if (!isLoggedIn || !role) {
        window.location.href = '/login.html';
        return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        alert('⚠️ คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
        redirectToRoleDashboard(role);
    }
}

export function redirectToRoleDashboard(role) {
    switch (role) {
        case 'teacher':
            window.location.href = '/apps/school-app/teacher.html';
            break;
        case 'student':
            window.location.href = '/apps/student-app/student.html';
            break;
        case 'parent':
            window.location.href = '/apps/parent-app/parent.html';
            break;
        default:
            window.location.href = '/login.html';
    }
}
