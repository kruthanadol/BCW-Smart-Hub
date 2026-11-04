// core/auth-service.js

const AuthService = {
    // 🟢 1. ฟังก์ชันยิง Google SSO (แก้ปัญหา AuthService.loginWithGoogle is not a function)
    loginWithGoogle: async function() {
        const client = window.supabase || window.db;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/login.html`
            }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย Google: ' + error.message);
    },

    // 🟢 2. ฟังก์ชันยิง LINE SSO
    loginWithLine: async function() {
        const client = window.supabase || window.db;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const { error } = await client.auth.signInWithOAuth({
            provider: 'line',
            options: {
                redirectTo: `${window.location.origin}/login.html`
            }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย LINE: ' + error.message);
    },

    // 🟢 3. สกัดข้อมูล Hybrid Profile หลัง Login สำเร็จ (รูป Google/LINE + ชื่อจริง DB)
    handlePostLogin: async function(ssoUser) {
        if (!ssoUser) return;

        const client = window.supabase || window.db;
        const email = (ssoUser.email || '').toLowerCase().trim();
        const userId = ssoUser.id || '';
        
        const ssoAvatar = ssoUser.user_metadata?.avatar_url || 
                          ssoUser.user_metadata?.picture || 
                          ssoUser.user_metadata?.photo_url || '';

        let detectedRole = 'STUDENT';
        let dbName = '';

        // A. สิทธิ์ Admin
        if (email === 'kruthanadol@buached.ac.th' || email.includes('admin')) {
            detectedRole = 'ADMIN';
            dbName = ssoUser.user_metadata?.full_name || 'ผู้ดูแลระบบ (ADMIN)';
        }

        // B. หาชื่อในตาราง teachers
        if (!dbName && client) {
            try {
                const { data: teacher } = await client
                    .from('teachers')
                    .select('*')
                    .or(`email.eq.${email},teacher_id.eq.${userId}`)
                    .maybeSingle();

                if (teacher) {
                    detectedRole = (teacher.role || 'TEACHER').toUpperCase();
                    dbName = teacher.full_name || teacher.teacher_name || '';
                }
            } catch (e) { console.warn('AuthService: Teacher query error:', e); }
        }

        // C. หาชื่อในตาราง students
        if (!dbName && client) {
            try {
                const { data: student } = await client
                    .from('students')
                    .select('*')
                    .or(`email.eq.${email},id.eq.${userId}`)
                    .maybeSingle();

                if (student) {
                    detectedRole = 'STUDENT';
                    dbName = `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
                }
            } catch (e) { console.warn('AuthService: Student query error:', e); }
        }

        // D. Fallback ชื่อ
        if (!dbName) {
            dbName = ssoUser.user_metadata?.full_name || ssoUser.user_metadata?.name || email.split('@')[0];
            if (email.includes('@buached.ac.th')) detectedRole = 'TEACHER';
        }

        const hybridProfile = {
            id: userId,
            name: dbName,
            avatar: ssoAvatar,
            role: detectedRole,
            email: email
        };

        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('bcw_user_session', JSON.stringify(hybridProfile));

        this.redirectToRolePage(detectedRole);
    },

    // 🟢 4. สั่งย้ายหน้าไปตาม Role
    redirectToRolePage: function(role) {
        const r = (role || 'STUDENT').toUpperCase();
        switch (r) {
            case 'ADMIN':
            case 'EXECUTIVE':
            case 'SUPERADMIN':
                window.location.replace('landing.html');
                break;
            case 'TEACHER':
                window.location.replace('apps/school-app/teacher.html');
                break;
            case 'STUDENT':
                window.location.replace('apps/school-app/student.html');
                break;
            case 'PARENT':
                window.location.replace('apps/school-app/parent.html');
                break;
            default:
                window.location.replace('landing.html');
                break;
        }
    }
};

if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
}
