import { db } from './supabase-client.js';

export async function checkAuthAndRoute() {
    try {
        let { data: { session } } = await db.auth.getSession();

        // 1. ตรวจสอบ LocalStorage ล็อกอินสำรอง (กรณีล็อกอินด้วยฟอร์มโรงเรียน)
        const isLoggedInLocal = localStorage.getItem('user_logged_in') === 'true';
        const localRole = (localStorage.getItem('user_role') || localStorage.getItem('role') || '').toLowerCase();
        const localEmail = localStorage.getItem('user_email') || '';
        const localId = localStorage.getItem('teacher_id') || localStorage.getItem('student_id') || localStorage.getItem('user_id') || '';

        // ถ้าไม่มีทั้ง Supabase Session และ LocalStorage ให้ส่งกลับ Login
        if (!session?.user && !isLoggedInLocal) {
            if (localStorage.getItem('parent_session')) {
                return { role: 'parent', target: 'apps/parent-app/parent.html' };
            }
            return { role: 'unauthenticated', target: 'login.html' };
        }

        const userEmail = (session?.user?.email || localEmail).toLowerCase().trim();
        const googleName = session?.user?.user_metadata?.full_name || localStorage.getItem('user_name') || userEmail;
        
        let rawPrefix = (userEmail.split('@')[0] || localId).toUpperCase();
        let cleanId = rawPrefix === 'T11' ? 'T011' : rawPrefix;

        // 2. ถ้ามี LocalStorage บันทึกไว้แล้ว ให้ใช้ค่านั้นนำทางทันที (ป้องกันการเด้งหลุด)
        if (isLoggedInLocal && localRole) {
            if (localRole === 'teacher' || localRole === 'admin' || localRole === 'executive') {
                const targetPage = (localRole === 'admin' || localRole === 'executive') 
                    ? 'landing.html' 
                    : 'apps/school-app/teacher.html';
                return { role: localRole, target: targetPage, name: localStorage.getItem('user_name') || googleName };
            } else if (localRole === 'student') {
                return { role: 'student', target: 'apps/student-app/student.html', name: localStorage.getItem('user_name') || googleName };
            }
        }

        // 3. ตรวจสอบตาราง users (ครู / ผู้บริหาร / แอดมิน)
        const { data: teacherProfile } = await db.from('users')
            .select('teacher_id, user_id, full_name, role, avatar_url')
            .or(`email.eq.${userEmail},teacher_id.eq.${cleanId},teacher_id.eq.T011`)
            .maybeSingle();

        if (teacherProfile) {
            const fullName = teacherProfile.full_name || googleName;
            const role = (teacherProfile.role || 'teacher').toLowerCase().trim();
            const teacherId = teacherProfile.teacher_id || teacherProfile.user_id || cleanId;

            localStorage.setItem('user_role', role);
            localStorage.setItem('role', role);
            localStorage.setItem('user_id', teacherId);
            localStorage.setItem('teacher_id', teacherId);
            localStorage.setItem('user_email', userEmail);
            localStorage.setItem('user_name', fullName);
            localStorage.setItem('user_logged_in', 'true');

            if (role === 'admin' || role === 'executive') {
                return { role: role, target: 'landing.html', name: fullName };
            } else {
                return { role: 'teacher', target: 'apps/school-app/teacher.html', name: fullName };
            }
        }

        // 4. ตรวจสอบตาราง students (นักเรียน)
        const { data: studentProfile } = await db.from('students')
            .select('student_id, prefix, first_name, last_name, classroom, avatar_url')
            .or(`email.eq.${userEmail},student_id.eq.${cleanId}`)
            .maybeSingle();

        if (studentProfile) {
            const fullName = `${studentProfile.prefix || ''}${studentProfile.first_name || ''} ${studentProfile.last_name || ''}`.trim() || googleName;
            const studentId = studentProfile.student_id || cleanId;

            localStorage.setItem('user_role', 'student');
            localStorage.setItem('role', 'student');
            localStorage.setItem('user_id', studentId);
            localStorage.setItem('student_id', studentId);
            localStorage.setItem('user_email', userEmail);
            localStorage.setItem('user_name', fullName);
            localStorage.setItem('user_logged_in', 'true');

            return { role: 'student', target: 'apps/student-app/student.html', name: fullName };
        }

        return { role: 'guest', target: 'landing.html', name: googleName };

    } catch (err) {
        console.error('Auth Manager Error:', err);
        // กรณีเกิด Error แต่มี LocalStorage อยู่ ให้ไปตามสิทธิ์ที่มี
        if (localStorage.getItem('user_logged_in') === 'true') {
            const role = localStorage.getItem('user_role') || 'teacher';
            return { role: role, target: role === 'student' ? 'apps/student-app/student.html' : 'apps/school-app/teacher.html' };
        }
        return { role: 'error', target: 'login.html' };
    }
}

export async function logoutUser() {
    try { await db.auth.signOut(); } catch (e) {}
    localStorage.clear();
    sessionStorage.clear();
    
    const path = window.location.pathname;
    if (path.includes('/apps/school-app/') || path.includes('/apps/student-app/') || path.includes('/apps/parent-app/')) {
        window.location.replace('../../login.html');
    } else {
        window.location.replace('login.html');
    }
}
