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
        
        const redirectUrl = window.location.origin + this.getRepoPrefix() + '/login.html';
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
        
        const redirectUrl = window.location.origin + this.getRepoPrefix() + '/login.html';
        const { error } = await client.auth.signInWithOAuth({
            provider: 'line',
            options: { redirectTo: redirectUrl }
        });
        if (error) alert('เกิดข้อผิดพลาดในการล็อกอินด้วย LINE: ' + error.message);
    },

    // 🟢 3. สกัด Hybrid Profile โดยเช็กตาราง users -> teachers -> students ตามลำดับ
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

            let detectedRole = null;
            let dbName = '';

            // 👑 Step 0: ล็อกอีเมล Admin เฉพาะบุคคล
            if (email === 'kruthanadol@buached.ac.th') {
                detectedRole = 'ADMIN';
                dbName = ssoUser.user_metadata?.full_name || 'ผู้ดูแลระบบ';
            }

            // 🟢 Step 1: ตรวจสอบจากตาราง `users` เป็นลำดับแรก
            if (!detectedRole && client && (email || userId)) {
                try {
                    let userQuery = client.from('users').select('*');
                    if (email) {
                        userQuery = userQuery.eq('email', email);
                    } else if (userId) {
                        userQuery = userQuery.eq('id', userId);
                    }
                    
                    const { data: userRec } = await userQuery.maybeSingle();

                    if (userRec && userRec.role) {
                        detectedRole = userRec.role.toUpperCase();
                        dbName = userRec.full_name || userRec.name || userRec.display_name || '';
                        console.log('✅ พบข้อมูลในตาราง users:', userRec);
                    }
                } catch (e) {
                    console.warn('Users table query notice:', e);
                }
            }

            // 🟢 Step 2: ถ้าใน users ไม่พบ role ให้เช็กตาราง `teachers`
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
                        console.log('✅ พบข้อมูลในตาราง teachers:', teacher);
                    }
                } catch (e) { console.warn('Teacher Query Error:', e); }
            }

            // 🟢 Step 3: ถ้ายังไม่พบ ให้เช็กตาราง `students`
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
                        console.log('✅ พบข้อมูลในตาราง students:', student);
                    }
                } catch (e) { console.warn('Student Query Error:', e); }
            }

            // 🟢 Step 4: Fallback สำหรับผู้ใช้ที่ไม่มีข้อมูลในตารางเลย
            if (!detectedRole) {
                dbName = ssoUser.user_metadata?.full_name || ssoUser.user_metadata?.name || (email ? email.split('@')[0] : 'ผู้ใช้งาน');
                detectedRole = email.endsWith('@buached.ac.th') ? 'STUDENT' : 'PARENT';
            }

            if (!dbName) dbName = ssoUser.user_metadata?.full_name || 'ผู้ใช้งานระบบ';

            const hybridProfile = {
                id: userId,
                name: dbName,
                avatar: ssoAvatar,
                role: detectedRole,
                email: email
            };

            console.log('📌 ผลการคัดกรองโปรไฟล์สุดท้าย:', hybridProfile);

            // บันทึก Session ลงทั้ง สองที่
            const sessionStr = JSON.stringify(hybridProfile);
            localStorage.setItem('bcw_user_session', sessionStr);
            sessionStorage.setItem('bcw_user_session', sessionStr);

            // ย้ายหน้าตามบทบาทจริงที่สกัดได้
            this.redirectToRolePage(detectedRole);

        } catch (err) {
            console.error('handlePostLogin Error:', err);
            this.isProcessingLogin = false;
        }
    },

    // 🟢 4. ส่งตัวผู้ใช้ไปยังหน้าตามบทบาท
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
