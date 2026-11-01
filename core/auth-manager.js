import { db } from './supabase-client.js';

export async function checkAuthAndRoute() {
    try {
        let { data: { session } } = await db.auth.getSession();

        const isLoggedInLocal = localStorage.getItem('user_logged_in') === 'true';
        const localRole = (localStorage.getItem('user_role') || localStorage.getItem('role') || '').toLowerCase().trim();
        const localEmail = localStorage.getItem('user_email') || '';
        const localId = localStorage.getItem('teacher_id') || localStorage.getItem('student_id') || localStorage.getItem('user_id') || '';

        // ถ้าไม่มีทั้ง Supabase Session และ LocalStorage Flag ให้ส่งกลับ Login
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

        // หากมีการล็อกอินอยู่แล้วใน LocalStorage ให้คงสิทธิ์ไว้ ไม่ส่งกลับ Login
        if (isLoggedInLocal && localRole) {
            return { 
                role: localRole, 
                name: localStorage.getItem('user_name') || googleName,
                target: localRole === 'student' ? 'apps/student-app/student.html' : 'apps/school-app/teacher.html'
            };
        }

        // ค้นหาตาราง users (ครู / ผู้บริหาร / แอดมิน)
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

            return { role: role, target: 'apps/school-app/teacher.html', name: fullName };
        }

        return { role: 'guest', target: 'landing.html', name: googleName };

    } catch (err) {
        console.error('Auth Manager Error:', err);
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
