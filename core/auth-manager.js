import { db } from './supabase-client.js';

export async function checkAuthAndRoute() {
    try {
        let { data: { session } } = await db.auth.getSession();

        if (!session) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const retry = await db.auth.getSession();
            session = retry.data?.session;
        }

        // กรณีไม่มี Session ผู้ใช้
        if (!session || !session.user) {
            if (localStorage.getItem('parent_session')) {
                return { role: 'parent', target: 'apps/parent-app/parent.html' };
            }
            return { role: 'unauthenticated', target: 'login.html' };
        }

        const userEmail = (session.user.email || '').toLowerCase().trim();
        const googleName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || userEmail;
        const cleanId = userEmail.split('@')[0].toLowerCase();

        // 1. ตรวจสอบตาราง users (ครู / ผู้บริหาร / แอดมิน)
        const { data: teacherProfile } = await db.from('users')
            .select('user_id, role, prefix, first_name, last_name')
            .eq('email', userEmail)
            .maybeSingle();

        if (teacherProfile) {
            const fullName = `${teacherProfile.prefix || ''}${teacherProfile.first_name || ''} ${teacherProfile.last_name || ''}`.trim() || googleName;
            
            // ป้องกันปัญหาตัวพิมพ์เล็ก/ใหญ่ (TEACHER / ADMIN)
            const role = (teacherProfile.role || 'teacher').toLowerCase().trim();

            localStorage.setItem('user_role', role);
            localStorage.setItem('user_id', teacherProfile.user_id || cleanId);
            localStorage.setItem('teacher_id', teacherProfile.user_id || cleanId);
            localStorage.setItem('user_email', userEmail);
            localStorage.setItem('user_name', fullName);
            localStorage.setItem('user_logged_in', 'true');

            // แยกเป้าหมายให้ชัดเจน:
            // - ถ้าเป็น admin หรือ executive ➔ ให้อยู่หน้า Smart Hub (landing.html)
            // - ถ้าเป็น teacher ➔ ให้ไปหน้าครู (apps/school-app/teacher.html)
            if (role === 'admin' || role === 'executive') {
                return { role: role, target: 'landing.html', name: fullName };
            } else {
                return { role: 'teacher', target: 'apps/school-app/teacher.html', name: fullName };
            }
        }

        // 2. ตรวจสอบตาราง students (นักเรียน)
        const { data: studentProfile } = await db.from('students')
            .select('student_id, prefix, first_name, last_name')
            .or(`email.eq.${userEmail},student_id.eq.${cleanId}`)
            .maybeSingle();

        if (studentProfile) {
            const fullName = `${studentProfile.prefix || ''}${studentProfile.first_name || ''} ${studentProfile.last_name || ''}`.trim() || googleName;

            localStorage.setItem('user_role', 'student');
            localStorage.setItem('user_id', studentProfile.student_id);
            localStorage.setItem('student_id', studentProfile.student_id);
            localStorage.setItem('user_email', userEmail);
            localStorage.setItem('user_name', fullName);
            localStorage.setItem('user_logged_in', 'true');

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

// ฟังก์ชัน Logout กลางสำหรับล้างข้อมูลทุกอย่าง
export async function logoutUser() {
    try {
        await db.auth.signOut();
    } catch (e) {}
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('login.html');
}
