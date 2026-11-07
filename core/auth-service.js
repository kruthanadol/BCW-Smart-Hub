// core/auth-service.js
const AuthService = {
    isProcessingLogin: false,

    loginWithGoogle: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        const redirectUrl = window.location.origin + window.location.pathname;
        await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl } });
    },

    loginWithLine: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        const redirectUrl = window.location.origin + window.location.pathname;
        await client.auth.signInWithOAuth({ provider: 'line', options: { redirectTo: redirectUrl } });
    },

    // 🟢 คัดกรองบทบาทแบบแยกฝั่งเด็ดขาด
    handlePostLogin: async function(ssoUser) {
        if (!ssoUser || this.isProcessingLogin) return;
        this.isProcessingLogin = true;

        try {
            const client = window.supabaseClient || window.db || window.supabase;
            const email = (ssoUser.email || '').toLowerCase().trim();
            const userId = ssoUser.id || '';
            const ssoAvatar = ssoUser.user_metadata?.avatar_url || ssoUser.user_metadata?.picture || '';
            
            let detectedRole = 'STUDENT'; // Default สำหรับฝั่งนักเรียน/ผู้ปกครอง
            let dbName = '';

            // 👑 สายที่ 1: แอดมิน / ผู้บริหาร (เข้า landing.html)
            if (email === 'kruthanadol@buached.ac.th' || email.includes('admin')) {
                detectedRole = 'ADMIN';
                dbName = ssoUser.user_metadata?.full_name || 'ผู้ดูแลระบบ';
            }

            // 👨‍🏫 สายที่ 2: เช็กตารางครู (teachers) -> ถ้าเจอ ไปหน้าครู
            if (!dbName && client) {
                try {
                    const { data: teacher } = await client
                        .from('teachers')
                        .select('*')
                        .or(`email.eq.${email},teacher_id.eq.${userId}`)
                        .maybeSingle();

                    if (teacher) {
                        detectedRole = 'TEACHER';
                        dbName = teacher.full_name || teacher.teacher_name || 'คุณครู';
                    }
                } catch (e) { console.warn('Teacher query error:', e); }
            }

            // 👨‍🎓 สายที่ 3: เช็กตารางนักเรียน/ผู้ปกครอง (students) -> ถ้าเจอหรืออื่นๆ ไปฝั่งนักเรียน/ผู้ปกครอง
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
                } catch (e) { console.warn('Student query error:', e); }
            }

            // Fallback: ถ้าไม่พบใน DB เลย ให้ถือว่าเป็นฝั่งนักเรียน/ผู้ปกครอง หรือบุคคลทั่วไป
            if (!dbName) {
                dbName = ssoUser.user_metadata?.full_name || ssoUser.user_metadata?.name || email.split('@')[0];
                detectedRole = email.includes('@buached.ac.th') ? 'STUDENT' : 'PARENT';
            }

            const hybridProfile = {
                id: userId,
                name: dbName,
                avatar: ssoAvatar,
                role: detectedRole,
                email: email
            };

            // บันทึก Session
            const sessionStr = JSON.stringify(hybridProfile);
            localStorage.setItem('bcw_user_session', sessionStr);
            sessionStorage.setItem('bcw_user_session', sessionStr);

            // ส่งตัวแยกตามสายงานทันที
            this.redirectToRolePage(detectedRole);
        } catch (err) {
            console.error('Login Error:', err);
            this.isProcessingLogin = false;
        }
    },

    // 🟢 แยกการดีดหน้าชัดเจน ไม่เกี่ยวข้องกัน
    redirectToRolePage: function(role) {
        const r = (role || 'STUDENT').toUpperCase();
        const currentPath = window.location.pathname;

        const pathSegments = currentPath.split('/').filter(Boolean);
        let repoPrefix = '';
        if (window.location.hostname.includes('github.io') && pathSegments.length > 0) {
            repoPrefix = '/' + pathSegments[0];
        }

        let targetPage = '/apps/school-app/student.html'; // Default นักเรียน/ผู้ปกครอง

        if (r === 'ADMIN' || r === 'EXECUTIVE' || r === 'SUPERADMIN') {
            targetPage = '/landing.html'; // ผู้บริหาร/แอดมิน
        } else if (r === 'TEACHER') {
            targetPage = '/apps/school-app/teacher.html'; // ครู
        } else if (r === 'PARENT') {
            targetPage = '/apps/school-app/parent.html'; // ผู้ปกครอง
        }

        const fullUrl = repoPrefix + targetPage;

        if (!currentPath.endsWith(targetPage)) {
            window.location.replace(fullUrl);
        }
    }
};

window.AuthService = AuthService;
