// core/auth-service.js
const AuthService = {
    // 🟢 1. สั่งยิง Google SSO
    loginWithGoogle: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {// core/auth-service.js
const AuthService = {
    // 🟢 1. สั่งยิง Google SSO
    loginWithGoogle: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/login.html`
            }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย Google: ' + error.message);
    },

    // 🟢 2. สั่งยิง LINE SSO
    loginWithLine: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const { error } = await client.auth.signInWithOAuth({
            provider: 'line',
            options: {
                redirectTo: `${window.location.origin}/login.html`
            }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย LINE: ' + error.message);
    },

    // 🟢 3. สกัด Hybrid Profile ตามบทบาทจริงจาก DB
    handlePostLogin: async function(ssoUser) {
        if (!ssoUser) return;

        const client = window.supabaseClient || window.db || window.supabase;
        const email = (ssoUser.email || '').toLowerCase().trim();
        const userId = ssoUser.id || '';
        
        const ssoAvatar = ssoUser.user_metadata?.avatar_url || 
                          ssoUser.user_metadata?.picture || 
                          ssoUser.user_metadata?.photo_url || '';

        let detectedRole = 'STUDENT';
        let dbName = '';

        // A. สิทธิ์ Admin / Executive
        if (email === 'kruthanadol@buached.ac.th' || email.includes('admin')) {
            detectedRole = 'ADMIN';
            dbName = ssoUser.user_metadata?.full_name || 'ผู้ดูแลระบบ (ADMIN)';
        }

        // B. ค้นหาในตาราง teachers (ครู)
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

        // C. ค้นหาในตาราง students (นักเรียน)
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

        // D. Fallback หากเป็นผู้ปกครองหรืออื่นๆ
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

        // บันทึก Session กลางเข้า LocalStorage
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('bcw_user_session', JSON.stringify(hybridProfile));

        // ส่งตัวย้ายหน้าตามบทบาท
        this.redirectToRolePage(detectedRole);
    },

    // 🟢 4. กฎการส่งตัวตามบทบาท (Routing Logic)
    redirectToRolePage: function(role) {
        const r = (role || 'STUDENT').toUpperCase();
        const currentPath = window.location.pathname;

        switch (r) {
            // 👑 ผู้บริหาร / แอดมิน ➔ ไป landing.html (และสามารถกดเข้าทุกหน้าได้ไม่โดนบล็อก)
            case 'ADMIN':
            case 'EXECUTIVE':
            case 'SUPERADMIN':
                if (!currentPath.endsWith('/landing.html')) {
                    window.location.replace('/landing.html');
                }
                break;

            // 👨‍🏫 ครู ➔ ไป teacher.html (และอนุญาตให้กดเข้า landing.html ได้)
            case 'TEACHER':
                if (!currentPath.endsWith('/apps/school-app/teacher.html') && !currentPath.endsWith('/landing.html')) {
                    window.location.replace('/apps/school-app/teacher.html');
                }
                break;

            // 👨‍🎓 นักเรียน ➔ ไป student.html
            case 'STUDENT':
                if (!currentPath.endsWith('/apps/school-app/student.html')) {
                    window.location.replace('/apps/school-app/student.html');
                }
                break;

            // 👨‍👩‍👧 ผู้ปกครอง ➔ ไป parent.html
            case 'PARENT':
                if (!currentPath.endsWith('/apps/school-app/parent.html')) {
                    window.location.replace('/apps/school-app/parent.html');
                }
                break;

            default:
                if (!currentPath.endsWith('/landing.html')) {
                    window.location.replace('/landing.html');
                }
                break;
        }
    }
};

window.AuthService = AuthService;
                redirectTo: `${window.location.origin}/login.html`
            }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย Google: ' + error.message);
    },

    // 🟢 2. สั่งยิง LINE SSO
    loginWithLine: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const { error } = await client.auth.signInWithOAuth({
            provider: 'line',
            options: {
                redirectTo: `${window.location.origin}/login.html`
            }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย LINE: ' + error.message);
    },

    // 🟢 3. สกัดข้อมูล Hybrid Profile หลัง Login สำเร็จ (รูป SSO + ชื่อ DB)
    handlePostLogin: async function(ssoUser) {
        if (!ssoUser) return;

        const client = window.supabaseClient || window.db || window.supabase;
        const email = (ssoUser.email || '').toLowerCase().trim();
        const userId = ssoUser.id || '';
        
        const ssoAvatar = ssoUser.user_metadata?.avatar_url || 
                          ssoUser.user_metadata?.picture || 
                          ssoUser.user_metadata?.photo_url || '';

        let detectedRole = 'STUDENT';
        let dbName = '';

        // สิทธิ์ Admin
        if (email === 'kruthanadol@buached.ac.th' || email.includes('admin')) {
            detectedRole = 'ADMIN';
            dbName = ssoUser.user_metadata?.full_name || 'ผู้ดูแลระบบ (ADMIN)';
        }

        // ค้นหาในตาราง teachers
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

        // ค้นหาในตาราง students
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

        // Fallback ชื่อกรณีไม่เจอใน DB
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

        // เซฟเข้าคีย์กลางจุดเดียว
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('bcw_user_session', JSON.stringify(hybridProfile));

        // ย้ายหน้าตามสิทธิ์
        this.redirectToRolePage(detectedRole);
    },

    // 🟢 4. ระบบย้ายหน้าด้วย Absolute Path (ใส่ / นำหน้า กัน 404 และกัน Loop เด้งวน)
    redirectToRolePage: function(role) {
        const r = (role || 'STUDENT').toUpperCase();
        const currentPath = window.location.pathname;

        switch (r) {
            case 'ADMIN':
            case 'EXECUTIVE':
            case 'SUPERADMIN':
                if (!currentPath.endsWith('/landing.html')) {
                    window.location.replace('/landing.html');
                }
                break;

            case 'TEACHER':
                if (!currentPath.endsWith('/teacher.html')) {
                    window.location.replace('/apps/school-app/teacher.html');
                }
                break;

            case 'STUDENT':
                if (!currentPath.endsWith('/student.html')) {
                    window.location.replace('/apps/school-app/student.html');
                }
                break;

            case 'PARENT':
                if (!currentPath.endsWith('/parent.html')) {
                    window.location.replace('/apps/school-app/parent.html');
                }
                break;

            default:
                if (!currentPath.endsWith('/landing.html')) {
                    window.location.replace('/landing.html');
                }
                break;
        }
    }
};

window.AuthService = AuthService;
