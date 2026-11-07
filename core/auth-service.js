// core/auth-service.js
const AuthService = {
    // 🟢 1. สั่งยิง Google SSO (รองรับทั้ง Localhost และ GitHub Pages)
    loginWithGoogle: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        // ดึง URL หน้า login ปัจจุบันแบบเต็ม เพื่อติดชื่อ Repository บน GitHub Pages
        const redirectUrl = window.location.origin + window.location.pathname;

        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย Google: ' + error.message);
    },

    // 🟢 2. สั่งยิง LINE SSO (แก้ไขส่วนซ้ำซ้อน และดึง Path ปัจจุบัน)
    loginWithLine: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const redirectUrl = window.location.origin + window.location.pathname;

        const { error } = await client.auth.signInWithOAuth({
            provider: 'line',
            options: {
                redirectTo: redirectUrl
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
            } catch (e) { 
                console.warn('AuthService: Teacher query error:', e); 
            }
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
            } catch (e) { 
                console.warn('AuthService: Student query error:', e); 
            }
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

    // 🟢 4. กฎการส่งตัวตามบทบาท (คำนวณ Base Path กันติด 404 บน GitHub Pages)
    redirectToRolePage: function(role) {
        const r = (role || 'STUDENT').toUpperCase();
        const currentPath = window.location.pathname;

        // คำนวณ Base Path สำหรับ GitHub Pages (ตัดเอาชื่อ Repository คืนมา)
        const pathSegments = currentPath.split('/').filter(Boolean);
        let basePath = '';
        
        // ถ้าอยู่บน github.io ให้เก็บ Repo Name เป็น Prefix ไว้ด้วย
        if (window.location.hostname.includes('github.io') && pathSegments.length > 0) {
            basePath = '/' + pathSegments[0];
        }

        let targetPath = '';

        switch (r) {
            // 👑 ผู้บริหาร / แอดมิน
            case 'ADMIN':
            case 'EXECUTIVE':
            case 'SUPERADMIN':
                targetPath = basePath + '/landing.html';
                break;

            // 👨‍🏫 ครู
            case 'TEACHER':
                targetPath = basePath + '/apps/school-app/teacher.html';
                break;

            // 👨‍🎓 นักเรียน
            case 'STUDENT':
                targetPath = basePath + '/apps/school-app/student.html';
                break;

            // 👨‍👩‍👧 ผู้ปกครอง
            case 'PARENT':
                targetPath = basePath + '/apps/school-app/parent.html';
                break;

            default:
                targetPath = basePath + '/landing.html';
                break;
        }

        // ป้องกัน Infinite Redirect Loop หากอยู่ที่หน้าเป้าหมายอยู่แล้ว
        if (!currentPath.endsWith(targetPath.replace(basePath, ''))) {
            window.location.replace(targetPath);
        }
    }
};

window.AuthService = AuthService;
