// core/auth-service.js
const AuthService = {
    // 🟢 ตัวแปรดักป้องกันการรัน handlePostLogin ซ้ำซ้อนจาก SSO Event
    isProcessingLogin: false,

    // 1. สั่งยิง Google SSO
    loginWithGoogle: async function() {
        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const redirectUrl = window.location.origin + window.location.pathname;

        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
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
            options: {
                redirectTo: redirectUrl
            }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย LINE: ' + error.message);
    },

    // 🟢 3. สกัด Hybrid Profile (พร้อมระบบ Lock ป้องกัน Session ลบตัวเอง)
    handlePostLogin: async function(ssoUser) {
        if (!ssoUser || this.isProcessingLogin) return;
        this.isProcessingLogin = true; // 🔒 ล็อกทันทีไม่ให้รันซ้ำ

        try {
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

            // 🔒 บันทึก Session เข้า LocalStorage & SessionStorage
            const sessionStr = JSON.stringify(hybridProfile);
            localStorage.setItem('bcw_user_session', sessionStr);
            sessionStorage.setItem('bcw_user_session', sessionStr);

            // ย้ายหน้าไปตามบทบาท
            this.redirectToRolePage(detectedRole);
        } catch (err) {
            console.error('handlePostLogin Error:', err);
            this.isProcessingLogin = false;
        }
    },

    // 🟢 4. กฎการส่งตัวตามบทบาท (Routing Logic)
    redirectToRolePage: function(role) {
        const r = (role || 'STUDENT').toUpperCase();
        const currentPath = window.location.pathname;

        // คำนวณ Base Path บน GitHub Pages
        const pathSegments = currentPath.split('/').filter(Boolean);
        let repoPrefix = '';
        if (window.location.hostname.includes('github.io') && pathSegments.length > 0) {
            repoPrefix = '/' + pathSegments[0];
        }

        let pageFile = '/landing.html';
        switch (r) {
            case 'ADMIN':
            case 'EXECUTIVE':
            case 'SUPERADMIN':
                pageFile = '/landing.html';
                break;
            case 'TEACHER':
                pageFile = '/apps/school-app/teacher.html';
                break;
            case 'STUDENT':
                pageFile = '/apps/school-app/student.html';
                break;
            case 'PARENT':
                pageFile = '/apps/school-app/parent.html';
                break;
            default:
                pageFile = '/landing.html';
                break;
        }

        const fullTargetUrl = repoPrefix + pageFile;

        // ถ้ายังไม่ได้อยู่ที่หน้าเป้าหมาย ให้เปลี่ยนหน้าทันที
        if (!currentPath.endsWith(pageFile)) {
            console.log('Redirecting to:', fullTargetUrl);
            window.location.replace(fullTargetUrl);
        }
    }
};

window.AuthService = AuthService;
