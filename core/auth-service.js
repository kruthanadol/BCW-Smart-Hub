// core/auth-service.js
const AuthService = {
    isProcessingLogin: false,

    // 🟢 คำนวณ Root Path ปัจจุบัน (รองรับทั้ง Localhost และ GitHub Pages Sub-folder)
    getRepoPrefix: function() {
        const currentPath = window.location.pathname;
        const pathSegments = currentPath.split('/').filter(Boolean);
        if (window.location.hostname.includes('github.io') && pathSegments.length > 0) {
            return '/' + pathSegments[0];
        }
        return '';
    },

    // 1. สั่งยิง Google SSO
    loginWithGoogle: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const redirectUrl = window.location.origin + window.location.pathname;
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: redirectUrl }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย Google: ' + error.message);
    },

    // 2. สั่งยิง LINE SSO
    loginWithLine: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const redirectUrl = window.location.origin + window.location.pathname;
        const { error } = await client.auth.signInWithOAuth({
            provider: 'line',
            options: { redirectTo: redirectUrl }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย LINE: ' + error.message);
    },

    // 🟢 3. สกัด Hybrid Profile และคัดกรองสายงาน
    handlePostLogin: async function(ssoUser) {
        if (!ssoUser || this.isProcessingLogin) return;
        this.isProcessingLogin = true;

        try {
            const client = window.supabaseClient || window.db || window.supabase;
            const email = (ssoUser.email || '').toLowerCase().trim();
            const userId = ssoUser.id || '';
            const ssoAvatar = ssoUser.user_metadata?.avatar_url || 
                              ssoUser.user_metadata?.picture || 
                              ssoUser.user_metadata?.photo_url || '';

            let detectedRole = 'STUDENT';
            let dbName = '';

            // 👑 สายที่ 1: แอดมิน / ผู้บริหาร (ไป landing.html)
            if (email === 'kruthanadol@buached.ac.th' || email.includes('admin')) {
                detectedRole = 'ADMIN';
                dbName = ssoUser.user_metadata?.full_name || 'ผู้ดูแลระบบ';
            }

            // 👨‍🏫 สายที่ 2: ตรวจสอบตาราง teachers (ไป teacher.html)
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
                } catch (e) { 
                    console.warn('Teacher Query Error:', e); 
                }
            }

            // 👨‍🎓 สายที่ 3: ตรวจสอบตาราง students (ไป student.html)
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
                } catch (e) { 
                    console.warn('Student Query Error:', e); 
                }
            }

            // Fallback: ถ้าไม่พบข้อมูลในตาราง ให้ถือเป็นฝั่งนักเรียน/ผู้ปกครอง
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

            // บันทึก Session ลงทั้ง สองที่
            const sessionStr = JSON.stringify(hybridProfile);
            localStorage.setItem('bcw_user_session', sessionStr);
            sessionStorage.setItem('bcw_user_session', sessionStr);

            // ย้ายหน้าตามบทบาท
            this.redirectToRolePage(detectedRole);
        } catch (err) {
            console.error('handlePostLogin Error:', err);
            this.isProcessingLogin = false;
        }
    },

    // 🟢 4. การส่งตัวตามบทบาท (Routing Logic)
    redirectToRolePage: function(role) {
        const r = (role || 'STUDENT').toUpperCase();
        const currentPath = window.location.pathname;
        const repoPrefix = this.getRepoPrefix();

        let targetPage = '/apps/school-app/student.html'; // Default

        if (['ADMIN', 'EXECUTIVE', 'SUPERADMIN'].includes(r)) {
            targetPage = '/landing.html';
        } else if (r === 'TEACHER') {
            targetPage = '/apps/school-app/teacher.html';
        } else if (r === 'PARENT') {
            targetPage = '/apps/school-app/parent.html';
        }

        const fullTargetUrl = repoPrefix + targetPage;

        if (!currentPath.endsWith(targetPage)) {
            window.location.replace(fullTargetUrl);
        }
    }
};

window.AuthService = AuthService;
