// core/auth-service.js - Unified Auth Architecture Edition (บำรุงรักษาจากโค้ดเดิม)
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
    loginWithLine: function() {
        const channelId = '2012514131'; // Channel ID ของคุณครู
        
        // ดึง URL หน้า login ปัจจุบันแบบถูกต้อง ไม่ตัดชื่อ repository
        const currentOrigin = window.location.origin; // เช่น https://kruthanadol.github.io
        const currentPathname = window.location.pathname; // เช่น /BCW-Smart-Hub/login.html
        const redirectUri = encodeURIComponent(currentOrigin + currentPathname);
        
        const state = Math.random().toString(36).substring(7);
    
        // ยิงตรงไป LINE Login API (ไม่ผ่าน Supabase Custom OIDC เพื่อตัดปัญหา Email Error)
        const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid`;
    
        window.location.href = lineAuthUrl;
    },

    // 🟢 5. เพิ่มการกรอกรหัสผ่าน Direct Login (ครู: T001/อีเมลจริง, นักเรียน: 13174, ผู้ปกครอง)
    loginWithPassword: async function(identifier, password) {
        if (this.isProcessingLogin) return;
        this.isProcessingLogin = true;

        try {
            const client = window.supabaseClient || window.db || window.supabase;
            if (!client) throw new Error("ไม่พบการเชื่อมต่อ Supabase Client");

            const input = (identifier || '').trim();
            const pass = (password || '').trim();
            const inputLower = input.toLowerCase();

            let detectedRole = null;
            let dbName = '';
            let userEmail = '';
            let teacherCode = '';
            let studentId = '';
            let avatarUrl = '';

            // Step 1: ค้นหาในตาราง users (ครู / Admin / ผู้บริหาร)
            try {
                let userQuery = client.from('users').select('*');
                if (inputLower.includes('@')) {
                    userQuery = userQuery.or(`email.eq.${inputLower},google_email.eq.${inputLower}`);
                } else {
                    userQuery = userQuery.or(`teacher_id.eq.${input},user_id.eq.${input},id.eq.${input}`);
                }

                const { data: userRec } = await userQuery.maybeSingle();

                if (userRec) {
                    if (userRec.password && userRec.password !== pass) {
                        throw new Error("รหัสผ่านไม่ถูกต้อง");
                    }
                    detectedRole = (userRec.role || 'TEACHER').toUpperCase();
                    dbName = userRec.full_name || userRec.name || 'คุณครู';
                    userEmail = userRec.email || inputLower;
                    teacherCode = userRec.teacher_id || userRec.user_id || input;
                    avatarUrl = userRec.avatar_url || '';
                }
            } catch (e) {
                if (e.message === "รหัสผ่านไม่ถูกต้อง") throw e;
                console.warn('Direct login users query notice:', e);
            }

            // Step 2: ถ้าไม่พบ ค้นหาต่อในตาราง students (นักเรียน / ผู้ปกครอง)
            if (!detectedRole) {
                try {
                    let studentQuery = client.from('students').select('*');
                    if (inputLower.includes('@')) {
                        studentQuery = studentQuery.or(`email.eq.${inputLower},student_google_email.eq.${inputLower}`);
                    } else {
                        studentQuery = studentQuery.or(`student_id.eq.${input},id.eq.${input}`);
                    }

                    const { data: student } = await studentQuery.maybeSingle();

                    if (student) {
                        // เช็กว่าเป็นรหัสผ่านผู้ปกครองหรือนักเรียน
                        if (student.parent_password && student.parent_password === pass) {
                            detectedRole = 'PARENT';
                        } else if (student.student_id && student.student_id === pass) {
                            detectedRole = 'STUDENT';
                        } else if (pass === '123456' || pass === student.student_id) {
                            detectedRole = 'STUDENT';
                        } else {
                            throw new Error("รหัสผ่านไม่ถูกต้อง");
                        }

                        const prefix = (student.prefix || '').trim();
                        const firstName = (student.first_name || '').trim();
                        const lastName = (student.last_name || '').trim();
                        
                        dbName = `${prefix}${firstName} ${lastName}`.trim() || 'นักเรียน';
                        userEmail = student.email || inputLower;
                        studentId = student.student_id || student.id;
                        avatarUrl = student.avatar_url || '';
                    }
                } catch (e) {
                    if (e.message === "รหัสผ่านไม่ถูกต้อง") throw e;
                    console.warn('Direct login students query notice:', e);
                }
            }

            if (!detectedRole) {
                throw new Error("ไม่พบข้อมูลผู้ใช้งาน หรือรหัสประจำตัวนี้ในระบบ");
            }

            // บันทึก Session และส่งไปยังหน้าปลายทาง
            const userProfile = {
                id: studentId || teacherCode || input,
                name: dbName,
                avatar: avatarUrl,
                role: detectedRole,
                email: userEmail,
                teacherId: teacherCode,
                studentId: studentId,
                provider: 'direct'
            };

            const sessionStr = JSON.stringify(userProfile);
            localStorage.setItem('bcw_user_session', sessionStr);
            sessionStorage.setItem('bcw_user_session', sessionStr);

            this.isProcessingLogin = false;
            this.redirectToRolePage(detectedRole);

        } catch (err) {
            this.isProcessingLogin = false;
            console.error('Direct Login Error:', err);
            alert('เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + err.message);
        }
    },

    // 🟢 6. ประมวลผลหลัง SSO สกัดบทบาทผู้ใช้งาน (RBAC - รองรับ Google & LINE)
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
            let studentId = '';

            // Step 0: ตรวจสอบ Admin ล็อกเฉพาะอีเมลประจำ
            if (email === 'kruthanadol@buached.ac.th') {
                detectedRole = 'ADMIN';
                dbName = ssoUser.user_metadata?.full_name || 'ผู้ดูแลระบบ';
            }

            // Step 1: ตรวจสอบจากตาราง users (ครู / Admin / ผู้บริหาร)
            if (!detectedRole && client && (email || userId)) {
                try {
                    let userQuery = client.from('users').select('*');
                    if (email) {
                        userQuery = userQuery.or(`email.eq.${email},google_email.eq.${email}`);
                    } else if (userId) {
                        userQuery = userQuery.or(`id.eq.${userId},line_user_id.eq.${userId}`);
                    }
                    
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
                        dbName = `${teacher.prefix || ''}${teacher.first_name || teacher.teacher_name || ''} ${teacher.last_name || ''}`.trim() || 'คุณครู';
                        teacherCode = teacher.teacher_id || teacher.code || teacher.teacher_code || 'T011';
                    }
                } catch (e) { console.warn('Teacher Query Error:', e); }
            }

            // Step 3: ตรวจสอบจากตาราง students (นักเรียน)
            if (!detectedRole && client && (email || userId)) {
                try {
                    let studentQuery = client.from('students').select('*');
                    if (email) {
                        studentQuery = studentQuery.or(`email.eq.${email},student_google_email.eq.${email}`);
                    } else if (userId) {
                        studentQuery = studentQuery.or(`id.eq.${userId},student_line_id.eq.${userId}`);
                    }

                    const { data: student } = await studentQuery.maybeSingle();

                    if (student) {
                        detectedRole = 'STUDENT';
                        studentId = student.student_id || student.id;
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
                id: userId || studentId || teacherCode,
                name: dbName,
                avatar: ssoAvatar,
                role: detectedRole,
                email: email,
                teacherId: teacherCode || 'T011',
                studentId: studentId,
                provider: ssoUser.app_metadata?.provider || 'sso'
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

    // 🟢 7. Redirect ไปยังหน้าประจำสิทธิ์ (ป้องกัน Loop และ URL เพี้ยน)
    redirectToRolePage: function(role) {
        const r = (role || 'STUDENT').toUpperCase();
        const currentPath = window.location.pathname;
        const repoPrefix = this.getRepoPrefix();

        let relativeTarget = '/apps/student-app/student.html';

        if (['ADMIN', 'EXECUTIVE', 'SUPERADMIN'].includes(r)) {
            relativeTarget = '/landing.html';
        } else if (r === 'TEACHER') {
            relativeTarget = '/apps/school-app/teacher.html';
        } else if (r === 'PARENT') {
            relativeTarget = '/apps/parent-app/parent.html';
        }

        const fullTargetUrl = repoPrefix + relativeTarget;

        if (!currentPath.endsWith(relativeTarget)) {
            window.location.replace(fullTargetUrl);
        }
    }
};

window.AuthService = AuthService;
