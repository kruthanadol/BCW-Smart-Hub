// core/auth-service.js
const AuthService = {
    isProcessingLogin: false,

    // 🟢 1. คำนวณ Prefix ของ Repo บน GitHub Pages ให้แม่นยำ ไม่ใส่ซ้ำซ้อน
    getRepoPrefix: function() {
        const hostname = window.location.hostname;
        const pathSegments = window.location.pathname.split('/').filter(Boolean);

        if (hostname.includes('github.io') && pathSegments.length > 0) {
            return '/' + pathSegments[0]; // คืนค่า '/BCW-Smart-Hub'
        }
        return '';
    },

    // 🟢 2. ดักจับและล้าง Error SSO ใน URL อัตโนมัติ (แก้ปัญหา Popup แจ้งสิทธิ์เด้งกวนใจ)
    checkAndCleanUrlError: function() {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.has('error') || urlParams.has('error_code')) {
            console.warn('⚠️ พบ Error จาก SSO ทำการล้าง URL และส่งกลับไปหน้า Login');
            
            localStorage.removeItem('bcw_user_session');
            sessionStorage.removeItem('bcw_user_session');

            const repoPrefix = this.getRepoPrefix();
            window.location.replace(window.location.origin + repoPrefix + '/login.html');
            return true;
        }
        return false;
    },

    // 🟢 3. เรียก OAuth Google
    loginWithGoogle: async function() {
        if (this.checkAndCleanUrlError()) return;

        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const redirectUrl = window.location.origin + this.getRepoPrefix() + '/login.html';
        const { error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: redirectUrl }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย Google: ' + error.message);
    },

    // 🟢 4. เรียก OAuth LINE
    loginWithLine: async function() {
        if (this.checkAndCleanUrlError()) return;

        const client = window.supabaseClient || window.db || window.supabase;
        if (!client || !client.auth) return alert('ไม่พบการเชื่อมต่อ Supabase');
        
        const redirectUrl = window.location.origin + this.getRepoPrefix() + '/login.html';
        const { error } = await client.auth.signInWithOAuth({
            provider: 'line',
            options: { redirectTo: redirectUrl }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย LINE: ' + error.message);
    },

    // 🟢 5. ประมวลผลหลัง SSO สกัดบทบาทผู้ใช้งาน (RBAC)
    handlePostLogin: async function(ssoUser) {
        // หาก URL ติด Error ให้หยุดและล้างค่าทันที
        if (this.checkAndCleanUrlError()) return;

        if (!ssoUser || this.isProcessingLogin) return;
        this.isProcessingLogin = true;

        try {
            const client = window.supabaseClient || window.db || window.supabase;
            const email = (ssoUser.email || '').toLowerCase().trim();
            const userId = ssoUser.id || '';
            const ssoAvatar = ssoUser.user_metadata?.avatar_url || 
                              ssoUser.user_metadata?.picture || 
                              ssoUser.user_metadata?.photo_url || '';

            let detectedRole = null;
            let dbName = '';
            let teacherCode = '';

            // Step 0: ตรวจสอบ Admin ล็อกเฉพาะอีเมล
            if (email === 'kruthanadol@buached.ac.th') {
                detectedRole = 'ADMIN';
                dbName = ssoUser.user_metadata?.full_name || 'ผู้ดูแลระบบ';
            }

            // Step 1: ตรวจสอบจากตาราง users
            if (!detectedRole && client && (email || userId)) {
                try {
                    let userQuery = client.from('users').select('*');
                    if (email) userQuery = userQuery.eq('email', email);
                    else if (userId) userQuery = userQuery.eq('id', userId);
                    
                    const { data: userRec } = await userQuery.maybeSingle();
                    if (userRec && userRec.role) {
                        detectedRole = userRec.role.toUpperCase();
                        dbName = userRec.full_name || userRec.name || userRec.display_name || '';
                        teacherCode = userRec.teacher_id || userRec.teacher_code || '';
                    }
                } catch (e) { console.warn('Users table query notice:', e); }
            }

            // Step 2: ตรวจสอบจากตาราง teachers
            if (!detectedRole && client && email) {
                try {
                    let { data: teacher } = await client
                        .from('teachers')
                        .select('*')
                        .eq('email', email)
                        .maybeSingle();

                    if (!teacher && userId) {
                        const { data: tById } = await client
                            .from('teachers')
                            .select('*')
                            .eq('teacher_id', userId)
                            .maybeSingle();
                        teacher = tById;
                    }

                    if (teacher) {
                        detectedRole = 'TEACHER';
                        dbName = teacher.full_name || teacher.teacher_name || 'คุณครู';
                        teacherCode = teacher.teacher_id || teacher.code || teacher.teacher_code || 'T011';
                    }
                } catch (e) { console.warn('Teacher Query Error:', e); }
            }

            // Step 3: ตรวจสอบจากตาราง students
            if (!detectedRole && client && email) {
                try {
                    let { data: student } = await client
                        .from('students')
                        .select('*')
                        .eq('email', email)
                        .maybeSingle();

                    if (!student && userId) {
                        const { data: sById } = await client
                            .from('students')
                            .select('*')
                            .eq('id', userId)
                            .maybeSingle();
                        student = sById;
                    }

                    if (student) {
                        detectedRole = 'STUDENT';
                        dbName = `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
                    }
                } catch (e) { console.warn('Student Query Error:', e); }
            }

            // Step 4: Fallback
            if (!detectedRole) {
                dbName = ssoUser.user_metadata?.full_name || ssoUser.user_metadata?.name || (email ? email.split('@')[0] : 'ผู้ใช้งาน');
                detectedRole = email.endsWith('@buached.ac.th') ? 'STUDENT' : 'PARENT';
            }

            if (!dbName) dbName = 'ผู้ใช้งานระบบ';

            const hybridProfile = {
                id: userId,
                name: dbName,
                avatar: ssoAvatar,
                role: detectedRole,
                email: email,
                teacherId: teacherCode || 'T011'
            };

            const sessionStr = JSON.stringify(hybridProfile);
            localStorage.setItem('bcw_user_session', sessionStr);
            sessionStorage.setItem('bcw_user_session', sessionStr);

            // ส่งต่อไปยังปลายทาง
            this.redirectToRolePage(detectedRole);

        } catch (err) {
            console.error('handlePostLogin Error:', err);
            this.isProcessingLogin = false;
        }
    },

    // 🟢 6. Redirect ไปยังหน้าประจำสิทธิ์ (ป้องกัน Loop และ URL เพี้ยน)
    redirectToRolePage: function(role) {
        const r = (role || 'STUDENT').toUpperCase();
        const currentPath = window.location.pathname;
        const repoPrefix = this.getRepoPrefix();

        let relativeTarget = '/apps/school-app/student.html';

        if (['ADMIN', 'EXECUTIVE', 'SUPERADMIN'].includes(r)) {
            relativeTarget = '/landing.html';
        } else if (r === 'TEACHER') {
            relativeTarget = '/apps/school-app/teacher.html';
        } else if (r === 'PARENT') {
            relativeTarget = '/apps/school-app/parent.html';
        }

        const fullTargetUrl = repoPrefix + relativeTarget;

        if (!currentPath.endsWith(relativeTarget)) {
            window.location.replace(fullTargetUrl);
        }
    }
};

window.AuthService = AuthService;
