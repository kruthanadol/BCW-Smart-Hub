// core/auth-service.js - Unified Auth Architecture Edition (Professional Modal UI Edition)
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

    // 🟢 2. ดักจับและล้าง Error SSO ใน URL อัตโนมัติ
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
        const channelId = '2012514131'; // LINE Channel ID
        
        const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
        const state = Math.random().toString(36).substring(7);
    
        const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid`;
    
        window.location.href = lineAuthUrl;
    },

    // 🟢 4.1 จัดการ Callback จาก LINE Login
    handleLineCallback: async function(code) {
        if (this.isProcessingLogin) return;
        this.isProcessingLogin = true;

        try {
            console.log('🔄 กำลังประมวลผล LINE Authorization Code:', code);
            const client = window.supabaseClient || window.db || window.supabase;
            const lineUserId = code; 

            let detectedRole = null;
            let dbName = '';
            let studentId = '';
            let teacherCode = '';
            let userEmail = '';

            // Step 1: เช็กตาราง users (ครู / Admin / ผู้บริหาร)
            if (client) {
                try {
                    const { data: userRec } = await client
                        .from('users')
                        .select('*')
                        .or(`line_user_id.eq.${lineUserId},line_code.eq.${code}`)
                        .maybeSingle();

                    if (userRec) {
                        detectedRole = (userRec.role || 'TEACHER').toUpperCase();
                        dbName = userRec.full_name || userRec.name || 'คุณครู';
                        teacherCode = userRec.teacher_id || userRec.user_id || '';
                        userEmail = userRec.email || '';
                    }
                } catch (e) { console.warn('Users table notice:', e); }
            }

            // Step 2: เช็กตาราง students (นักเรียน & ผู้ปกครอง)
            if (!detectedRole && client) {
                try {
                    // 2.1 เช็กนักเรียน
                    const { data: studentRec } = await client
                        .from('students')
                        .select('*')
                        .or(`student_line_id.eq.${lineUserId},student_line_id.eq.${code}`)
                        .maybeSingle();

                    if (studentRec) {
                        detectedRole = 'STUDENT';
                        studentId = studentRec.student_id || studentRec.id;
                        dbName = `${studentRec.prefix || ''}${studentRec.first_name || ''} ${studentRec.last_name || ''}`.trim();
                        userEmail = studentRec.email || '';
                    } else {
                        // 2.2 เช็กผู้ปกครอง
                        const { data: parentRec } = await client
                            .from('students')
                            .select('*')
                            .or(`parent_line_id.eq.${lineUserId},parent_line_id.eq.${code}`)
                            .maybeSingle();

                        if (parentRec) {
                            detectedRole = 'PARENT';
                            studentId = parentRec.student_id || parentRec.id;
                            dbName = `ผู้ปกครอง (${parentRec.prefix || ''}${parentRec.first_name || ''})`;
                            userEmail = parentRec.email || '';
                        }
                    }
                } catch (e) { console.warn('Students table notice:', e); }
            }

            // Step 3: หากยังไม่เคยผูก LINE ID ในระบบ ➔ แสดง Professional Custom Modal
            if (!detectedRole) {
                this.isProcessingLogin = false;
                this.promptLineBinding(lineUserId);
                return;
            }

            // Step 4: บันทึก Session และเข้าใช้งาน
            this.completeLoginSession(lineUserId, dbName, detectedRole, studentId, teacherCode, userEmail);

        } catch (err) {
            this.isProcessingLogin = false;
            console.error('Line Callback Processing Error:', err);
            alert('เกิดข้อผิดพลาดในการยืนยันตัวตนผ่าน LINE: ' + err.message);
        }
    },

    // 🟢 4.2 สร้างและแสดง Custom Modal สไตล์มืออาชีพสำหรับผูกบัญชี LINE
// 🟢 4.2 Custom Modal UI สวยงาม ละเอียด ป้องกัน CSS ตกบนมือถือและคอม
    promptLineBinding: function(lineUserId) {
        const existingModal = document.getElementById('lineBindingModal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="lineBindingModal" style="position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center; background-color: rgba(0,0,0,0.75); backdrop-filter: blur(8px); padding: 16px; font-family: 'Prompt', sans-serif;">
                <div style="background: #ffffff; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); max-width: 440px; width: 100%; overflow: hidden; animation: fadeInModal 0.3s ease-out forwards;">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 24px; text-align: center; color: white;">
                        <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; border: 1px solid rgba(255,255,255,0.4);">
                            <i class="fab fa-line" style="font-size: 32px; color: #ffffff;"></i>
                        </div>
                        <h3 style="font-size: 20px; font-weight: 700; margin: 0; color: #ffffff;">ผูกบัญชี LINE เข้าใช้งาน</h3>
                        <p style="font-size: 13px; color: #a7f3d0; margin-top: 4px;">กรุณายืนยันตัวตนครั้งแรกเพื่อเข้าใช้งานระบบ</p>
                    </div>

                    <!-- Body -->
                    <div style="padding: 20px;">
                        <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">เลือกประเภทผู้ใช้งาน</label>
                        
                        <!-- Role Selection Grid -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
                            <button type="button" onclick="AuthService.selectRoleOption('STUDENT')" id="btnRoleStudent" style="border: 2px solid #10b981; background: #ecfdf5; color: #047857; padding: 10px; border-radius: 14px; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; align-items: center; font-size: 13px;">
                                <span style="font-size: 20px; margin-bottom: 2px;">👨‍🎓</span> นักเรียน
                            </button>
                            <button type="button" onclick="AuthService.selectRoleOption('PARENT')" id="btnRoleParent" style="border: 2px solid #e5e7eb; background: #ffffff; color: #4b5563; padding: 10px; border-radius: 14px; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; align-items: center; font-size: 13px;">
                                <span style="font-size: 20px; margin-bottom: 2px;">👨‍👩‍👦</span> ผู้ปกครอง
                            </button>
                            <button type="button" onclick="AuthService.selectRoleOption('TEACHER')" id="btnRoleTeacher" style="border: 2px solid #e5e7eb; background: #ffffff; color: #4b5563; padding: 10px; border-radius: 14px; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; align-items: center; font-size: 13px;">
                                <span style="font-size: 20px; margin-bottom: 2px;">👨‍🏫</span> ครู / ผู้บริหาร
                            </button>
                            <button type="button" onclick="AuthService.selectRoleOption('ADMIN')" id="btnRoleAdmin" style="border: 2px solid #e5e7eb; background: #ffffff; color: #4b5563; padding: 10px; border-radius: 14px; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; align-items: center; font-size: 13px;">
                                <span style="font-size: 20px; margin-bottom: 2px;">🛠️</span> แอดมิน (Admin)
                            </button>
                        </div>

                        <!-- Input -->
                        <div style="margin-bottom: 16px;">
                            <label id="inputLabel" style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">กรอกรหัสนักเรียน (5 หลัก)</label>
                            <input type="text" id="bindInputCode" placeholder="เช่น 13174" 
                                style="width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #d1d5db; font-size: 14px; outline: none; box-sizing: border-box;">
                        </div>

                        <!-- Status Message -->
                        <div id="modalStatusMsg" style="display: none; font-size: 13px; padding: 10px; border-radius: 10px; text-align: center; font-weight: 500; margin-bottom: 14px;"></div>

                        <!-- Actions -->
                        <div style="display: flex; gap: 10px;">
                            <button type="button" onclick="document.getElementById('lineBindingModal').remove()" 
                                style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid #d1d5db; background: #ffffff; color: #4b5563; font-weight: 600; cursor: pointer; font-size: 14px;">
                                ยกเลิก
                            </button>
                            <button type="button" id="btnSubmitBind" onclick="AuthService.processLineBinding('${lineUserId}')" 
                                style="flex: 2; padding: 12px; border-radius: 12px; border: none; background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: white; font-weight: 600; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
                                🔗 เชื่อมต่อบัญชีทันที
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes fadeInModal {
                    from { opacity: 0; transform: scale(0.92); }
                    to { opacity: 1; transform: scale(1); }
                }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.currentSelectedRole = 'STUDENT';
    },

    // เลือก Role ใน Modal (อัปเดตสไตล์ Inline ป้องกันปัญหา CSS)
    selectRoleOption: function(role) {
        this.currentSelectedRole = role;
        const roles = ['STUDENT', 'PARENT', 'TEACHER', 'ADMIN'];

        roles.forEach(r => {
            const btnName = 'btnRole' + r.charAt(0) + r.slice(1).toLowerCase();
            const btn = document.getElementById(btnName);
            if (btn) {
                if (r === role) {
                    btn.style.border = '2px solid #10b981';
                    btn.style.background = '#ecfdf5';
                    btn.style.color = '#047857';
                } else {
                    btn.style.border = '2px solid #e5e7eb';
                    btn.style.background = '#ffffff';
                    btn.style.color = '#4b5563';
                }
            }
        });

        const label = document.getElementById('inputLabel');
        const input = document.getElementById('bindInputCode');

        if (role === 'STUDENT' || role === 'PARENT') {
            label.innerText = 'กรอกรหัสนักเรียน (5 หลัก)';
            input.placeholder = 'เช่น 13174';
        } else if (role === 'TEACHER') {
            label.innerText = 'กรอกรหัสครู (เช่น T001) หรือ อีเมลโรงเรียน';
            input.placeholder = 'เช่น T011 หรือ teacher@buached.ac.th';
        } else if (role === 'ADMIN') {
            label.innerText = 'กรอกอีเมลผู้ดูแลระบบ (Admin Email)';
            input.placeholder = 'เช่น kruthanadol@buached.ac.th';
        }
    },

    // ยืนยันข้อมูลใน Modal และบันทึกเข้า Supabase
    processLineBinding: async function(lineUserId) {
        const inputVal = (document.getElementById('bindInputCode').value || '').trim();
        const statusMsg = document.getElementById('modalStatusMsg');
        const btnSubmit = document.getElementById('btnSubmitBind');
        const role = this.currentSelectedRole || 'STUDENT';

        if (!inputVal) {
            statusMsg.className = 'text-sm p-3 rounded-xl text-center font-medium bg-red-50 text-red-600 block';
            statusMsg.innerText = '⚠️ กรุณากรอกรหัส หรือ อีเมลยืนยันตัวตน';
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerText = '⏳ กำลังบันทึกข้อมูล...';

        const client = window.supabaseClient || window.db || window.supabase;
        if (!client) {
            alert('ไม่พบการเชื่อมต่อฐานข้อมูล Supabase');
            btnSubmit.disabled = false;
            return;
        }

        try {
            let assignedRole = role;
            let displayName = '';
            let studentId = '';
            let teacherCode = '';
            let email = '';

            // 1. นักเรียน / ผู้ปกครอง
            if (role === 'STUDENT' || role === 'PARENT') {
                const { data: student, error } = await client
                    .from('students')
                    .select('*')
                    .eq('student_id', inputVal)
                    .maybeSingle();

                if (error || !student) {
                    throw new Error('ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาตรวจสอบอีกครั้ง');
                }

                let updateData = {};
                if (role === 'PARENT') {
                    updateData = { parent_line_id: lineUserId };
                    displayName = `ผู้ปกครอง (${student.prefix || ''}${student.first_name || ''})`;
                } else {
                    updateData = { student_line_id: lineUserId };
                    displayName = `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
                }

                await client.from('students').update(updateData).eq('id', student.id);
                studentId = student.student_id;
                email = student.email || '';
            } 
            // 2. ครู / ผู้บริหาร
            else if (role === 'TEACHER') {
                const inputClean = inputVal.toLowerCase();
                const { data: userRec, error } = await client
                    .from('users')
                    .select('*')
                    .or(`teacher_id.eq.${inputClean},email.eq.${inputClean},user_id.eq.${inputClean}`)
                    .maybeSingle();

                if (error || !userRec) {
                    throw new Error('ไม่พบรหัสครูหรืออีเมลนี้ในระบบ');
                }

                await client.from('users').update({ line_user_id: lineUserId }).eq('id', userRec.id);
                assignedRole = (userRec.role || 'TEACHER').toUpperCase();
                displayName = userRec.full_name || userRec.name || 'คุณครู';
                teacherCode = userRec.teacher_id || userRec.user_id || '';
                email = userRec.email || '';
            }
            // 3. แอดมิน
            else if (role === 'ADMIN') {
                if (inputVal.toLowerCase() !== 'kruthanadol@buached.ac.th') {
                    throw new Error('อีเมลนี้ไม่มีสิทธิ์ใช้งานในบทบาท Admin');
                }

                await client.from('users').update({ line_user_id: lineUserId }).eq('email', inputVal.toLowerCase());
                assignedRole = 'ADMIN';
                displayName = 'ผู้ดูแลระบบ';
                email = inputVal;
            }

            // สำเร็จ ➔ ลบ Modal และย้ายหน้า
            statusMsg.className = 'text-sm p-3 rounded-xl text-center font-medium bg-emerald-50 text-emerald-600 block';
            statusMsg.innerText = '✅ ผูกบัญชี LINE สำเร็จ! กำลังเข้าสู่ระบบ...';

            setTimeout(() => {
                document.getElementById('lineBindingModal').remove();
                this.completeLoginSession(lineUserId, displayName, assignedRole, studentId, teacherCode, email);
            }, 1000);

        } catch (err) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = '🔗 เชื่อมต่อบัญชีทันที';
            statusMsg.className = 'text-sm p-3 rounded-xl text-center font-medium bg-red-50 text-red-600 block';
            statusMsg.innerText = '❌ ' + err.message;
        }
    },

    // 🟢 4.3 ฟังก์ชันบันทึก Session และ Redirect
    completeLoginSession: function(id, name, role, studentId, teacherId, email) {
        const userProfile = {
            id: id,
            name: name,
            role: role,
            email: email,
            teacherId: teacherId,
            studentId: studentId,
            provider: 'line'
        };

        const sessionStr = JSON.stringify(userProfile);
        localStorage.setItem('bcw_user_session', sessionStr);
        sessionStorage.setItem('bcw_user_session', sessionStr);

        this.redirectToRolePage(role);
    },
        
    // 🟢 5. เพิ่มการกรอกรหัสผ่าน Direct Login
// 🟢 5. Direct Login (รองรับทั้งรหัส และ อีเมลรหัสนักเรียน/อีเมลครู)
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

            // ----------------------------------------------------
            // Step 1: ค้นหาในตาราง users (ครู / ผู้บริหาร / Admin)
            // ----------------------------------------------------
            try {
                let userQuery = client.from('users').select('*');
                
                if (inputLower.includes('@')) {
                    userQuery = userQuery.or(`email.eq.${inputLower},google_email.eq.${inputLower}`);
                } else {
                    userQuery = userQuery.or(`teacher_id.eq.${input},teacher_id.eq.${input.toUpperCase()},user_id.eq.${input},id.eq.${input}`);
                }

                const { data: userRec } = await userQuery.maybeSingle();

                if (userRec) {
                    if (userRec.password && String(userRec.password).trim() !== pass) {
                        throw new Error("รหัสผ่านไม่ถูกต้อง");
                    }
                    detectedRole = (userRec.role || 'TEACHER').toUpperCase();
                    dbName = userRec.full_name || userRec.name || 'คุณครู';
                    userEmail = userRec.email || inputLower;
                    teacherCode = userRec.teacher_id || userRec.user_id || userRec.id;
                    avatarUrl = userRec.avatar_url || '';
                }
            } catch (e) {
                if (e.message === "รหัสผ่านไม่ถูกต้อง") throw e;
                console.warn('Direct login users query notice:', e);
            }

            // ----------------------------------------------------
            // Step 2: ค้นหาในตาราง students (นักเรียน / ผู้ปกครอง)
            // ----------------------------------------------------
            if (!detectedRole) {
                try {
                    let studentQuery = client.from('students').select('*');
                    
                    // สกัดรหัสนักเรียนจากหน้า @ กรณีที่พิมพ์มาเป็นอีเมล (เช่น 13174@buached.ac.th ➔ 13174)
                    let extractedStudentId = input;
                    if (inputLower.includes('@')) {
                        extractedStudentId = inputLower.split('@')[0];
                    }

                    if (inputLower.includes('@')) {
                        studentQuery = studentQuery.or(`email.eq.${inputLower},student_google_email.eq.${inputLower},student_id.eq.${extractedStudentId}`);
                    } else {
                        studentQuery = studentQuery.eq('student_id', input);
                    }

                    const { data: student } = await studentQuery.maybeSingle();

                    if (student) {
                        const studentIdStr = String(student.student_id || '').trim();
                        const parentPassStr = String(student.parent_password || '').trim();

                        // 1. ตรวจสอบรหัสผ่านผู้ปกครอง (เช็ก parent_password)
                        if (parentPassStr && parentPassStr === pass) {
                            detectedRole = 'PARENT';
                        } 
                        // 2. ตรวจสอบรหัสผ่านนักเรียน (เช็ก student_id หรือ 123456)
                        else if (pass === studentIdStr || pass === '123456') {
                            detectedRole = 'STUDENT';
                        } 
                        else {
                            throw new Error("รหัสผ่านไม่ถูกต้อง");
                        }

                        const prefix = (student.prefix || '').trim();
                        const firstName = (student.first_name || '').trim();
                        const lastName = (student.last_name || '').trim();
                        
                        dbName = (detectedRole === 'PARENT') 
                            ? `ผู้ปกครอง (${prefix}${firstName})`
                            : `${prefix}${firstName} ${lastName}`.trim() || 'นักเรียน';

                        userEmail = student.email || student.student_google_email || inputLower;
                        studentId = studentIdStr;
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

            // บันทึก Session และส่งต่อไปยังหน้าประจำสิทธิ์
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
    // 🟢 6. ประมวลผลหลัง SSO
    handlePostLogin: async function(ssoUser) {
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

            if (email === 'kruthanadol@buached.ac.th') {
                detectedRole = 'ADMIN';
                dbName = ssoUser.user_metadata?.full_name || 'ผู้ดูแลระบบ';
            }

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

            this.isProcessingLogin = false;
            this.redirectToRolePage(detectedRole);

        } catch (err) {
            console.error('handlePostLogin Error:', err);
            this.isProcessingLogin = false;
        }
    },

    // 🟢 7. Redirect ไปยังหน้าประจำสิทธิ์
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
