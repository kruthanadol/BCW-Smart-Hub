import { db } from './supabase-client.js';

export async function checkAuthAndRoute() {
    try {
        let { data: { session } } = await db.auth.getSession();

        if (!session) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const retry = await db.auth.getSession();
            session = retry.data?.session;
        }

        // กรณีไม่มี Session ใน Supabase
        if (!session || !session.user) {
            if (localStorage.getItem('parent_session')) {
                return { role: 'parent', target: 'apps/parent-app/parent.html' };
            }
            return { role: 'unauthenticated', target: 'login.html' };
        }

        const userEmail = (session.user.email || '').toLowerCase().trim();
        const googleName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || userEmail;
        
        // Normalize cleanId (เช่น t11 / T11 -> T011)
        let rawPrefix = userEmail.split('@')[0].toUpperCase();
        let cleanId = rawPrefix === 'T11' ? 'T011' : rawPrefix;

        // 1. ตรวจสอบตาราง users (ครู / ผู้บริหาร / แอดมิน)
        const { data: teacherProfile } = await db.from('users')
            .select('teacher_id, user_id, full_name, role, avatar_url')
            .or(`email.eq.${userEmail},teacher_id.eq.${cleanId},teacher_id.eq.T011`)
            .maybeSingle();

        if (teacherProfile) {
            const fullName = teacherProfile.full_name || googleName;
            const role = (teacherProfile.role || 'teacher').toLowerCase().trim();
            const teacherId = teacherProfile.teacher_id || teacherProfile.user_id || cleanId;

            // ตั้งค่า Standard LocalStorage สำหรับฝั่งครู
            localStorage.setItem('user_role', role);
            localStorage.setItem('role', role);
            localStorage.setItem('user_id', teacherId);
            localStorage.setItem('teacher_id', teacherId);
            localStorage.setItem('user_email', userEmail);
            localStorage.setItem('user_name', fullName);
            localStorage.setItem('user_logged_in', 'true');
            if (teacherProfile.avatar_url) localStorage.setItem('user_avatar', teacherProfile.avatar_url);

            if (role === 'admin' || role === 'executive') {
                return { role: role, target: 'landing.html', name: fullName };
            } else {
                return { role: 'teacher', target: 'apps/school-app/teacher.html', name: fullName };
            }
        }

        // 2. ตรวจสอบตาราง students (นักเรียน)
        const { data: studentProfile } = await db.from('students')
            .select('student_id, prefix, first_name, last_name, classroom, avatar_url')
            .or(`email.eq.${userEmail},student_id.eq.${cleanId}`)
            .maybeSingle();

        if (studentProfile) {
            const fullName = `${studentProfile.prefix || ''}${studentProfile.first_name || ''} ${studentProfile.last_name || ''}`.trim() || googleName;
            const studentId = studentProfile.student_id || cleanId;

            // ตั้งค่า Standard LocalStorage สำหรับฝั่งนักเรียน
            localStorage.setItem('user_role', 'student');
            localStorage.setItem('role', 'student');
            localStorage.setItem('user_id', studentId);
            localStorage.setItem('student_id', studentId);
            localStorage.setItem('user_email', userEmail);
            localStorage.setItem('user_name', fullName);
            localStorage.setItem('classroom', studentProfile.classroom || '');
            localStorage.setItem('user_logged_in', 'true');
            if (studentProfile.avatar_url) localStorage.setItem('user_avatar', studentProfile.avatar_url);

            return { role: 'student', target: 'apps/student-app/student.html', name: fullName };
        }

        // กรณีเป็น Guest
        localStorage.setItem('user_role', 'guest');
        return { role: 'guest', target: 'landing.html', name: googleName };

    } catch (err) {
        console.error('Auth Manager Error:', err);
        return { role: 'error', target: 'login.html' };
    }
}

// ฟังก์ชัน Logout กลาง คำนวณ Relative Path ให้ถูกต้อง
export async function logoutUser() {
    try {
        await db.auth.signOut();
    } catch (e) {}
    localStorage.clear();
    sessionStorage.clear();
    
    // ตรวจสอบระดับชั้นของพาธเพื่อ Redirect กลับ login.html ได้ถูกต้อง
    const path = window.location.pathname;
    if (path.includes('/apps/school-app/') || path.includes('/apps/student-app/') || path.includes('/apps/parent-app/')) {
        window.location.replace('../../login.html');
    } else {
        window.location.replace('login.html');
    }
}
