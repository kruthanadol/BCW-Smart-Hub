// core/auth-service.js - Complete Unified Auth, Avatar & LINE Real-ID Edition
const AuthService = {
    isProcessingLogin: false,
    currentSelectedRole: 'STUDENT',
    pendingLineProfile: null,

    getRepoPrefix: function() {
        const hostname = window.location.hostname;
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        if (hostname.includes('github.io') && pathSegments.length > 0) {
            return '/' + pathSegments[0];
        }
        return '';
    },

    checkAndCleanUrlError: function() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('error') || urlParams.has('error_code')) {
            console.warn('⚠️ พบ Error จาก SSO ทำการล้าง URL');
            localStorage.removeItem('bcw_user_session');
            sessionStorage.removeItem('bcw_user_session');
            document.documentElement.classList.remove('bcw-fast-redirect');
            const repoPrefix = this.getRepoPrefix();
            window.location.replace(window.location.origin + repoPrefix + '/login.html');
            return true;
        }
        return false;
    },

    // 🟢 1. Google SSO Login
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

    // 🟢 2. LINE OAuth Login
    loginWithLine: function() {
        const savedSessionStr = localStorage.getItem('bcw_user_session');
        const boundIdentity = localStorage.getItem('bcw_bound_identity');
        const savedRole = localStorage.getItem('bcw_bound_role');

        if (savedSessionStr && boundIdentity) {
            try {
                const session = JSON.parse(savedSessionStr);
                if (session && session.role) {
                    this.redirectToRolePage(session.role);
                    return;
                }
            } catch (e) {}
        } else if (savedRole && boundIdentity) {
            this.redirectToRolePage(savedRole);
            return;
        }

        const channelId = '2012514131';
        const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
        const state = Math.random().toString(36).substring(7);
        const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid`;
        window.location.href = lineAuthUrl;
    },

    // 🟢 3. จัดการ Callback จาก LINE Login (แลก Token ดึง LINE User ID ตัวจริง + รูปโปรไฟล์)
    handleLineCallback: async function(code) {
        if (this.isProcessingLogin) return;
        this.isProcessingLogin = true;

        try {
            const client = window.supabaseClient || window.db || window.supabase;
            if (!client) throw new Error('ไม่พบการเชื่อมต่อ Supabase');

            const redirectUri = window.location.origin + window.location.pathname;
            const { data: lineData, error: fnError } = await client.functions.invoke('line-token-exchange', {
                body: { code: code, redirectUri: redirectUri }
            });

            if (fnError || !lineData || !lineData.lineUserId) {
                throw new Error(fnError?.message || lineData?.error || 'ไม่สามารถยืนยันตัวตนกับ LINE API ได้');
            }

            const realLineUserId = lineData.lineUserId;
            const linePictureUrl = lineData.pictureUrl || '';
            this.pendingLineProfile = {
                lineUserId: realLineUserId,
                displayName: lineData.displayName || '',
                pictureUrl: linePictureUrl
            };

            window.history.replaceState({}, document.title, window.location.pathname);

            let detectedRole = null;
            let dbName = '';
            let studentId = '';
            let teacherCode = '';
            let userEmail = '';
            let avatarUrl = linePictureUrl;

            // Step A: ค้นหาในตาราง users (ครู / ผู้บริหาร / Admin)
            const { data: userRec } = await client
                .from('users')
                .select('*')
                .eq('line_user_id', realLineUserId)
                .maybeSingle();

            if (userRec) {
                detectedRole = (userRec.role || 'TEACHER').toUpperCase();
                dbName = userRec.full_name || userRec.name || 'คุณครู';
                teacherCode = userRec.teacher_id || userRec.user_id || userRec.id;
                userEmail = userRec.email || '';
                avatarUrl = userRec.avatar_url || userRec.photo_url || linePictureUrl;

                if (!userRec.avatar_url && linePictureUrl) {
                    await client.from('users').update({ avatar_url: linePictureUrl }).eq('id', userRec.id);
                }
            }

            // Step B: ค้นหาในตาราง students (นักเรียน / ผู้ปกครอง)
            if (!detectedRole) {
                const { data: studentRec } = await client
                    .from('students')
                    .select('*')
                    .eq('student_line_id', realLineUserId)
                    .maybeSingle();

                if (studentRec) {
                    detectedRole = 'STUDENT';
                    studentId = studentRec.student_id || studentRec.id;
                    dbName = `${studentRec.prefix || ''}${studentRec.first_name || ''} ${studentRec.last_name || ''}`.trim();
                    userEmail = studentRec.email || `${studentId}@buached.ac.th`;
                    avatarUrl = studentRec.avatar_url || linePictureUrl;

                    if (!studentRec.avatar_url && linePictureUrl) {
                        await client.from('students').update({ avatar_url: linePictureUrl }).eq('student_id', studentRec.student_id);
                    }
                } else {
                    const { data: parentRec } = await client
                        .from('students')
                        .select('*')
                        .eq('parent_line_id', realLineUserId)
                        .limit(1)
                        .maybeSingle();

                    if (parentRec) {
                        detectedRole = 'PARENT';
                        studentId = parentRec.student_id || parentRec.id;
                        dbName = `ผู้ปกครอง (${parentRec.prefix || ''}${parentRec.first_name || ''})`;
                        userEmail = parentRec.email || `${studentId}@buached.ac.th`;
                        avatarUrl = parentRec.parent_avatar_url || linePictureUrl;

                        if (!parentRec.parent_avatar_url && linePictureUrl) {
                            await client.from('students').update({ parent_avatar_url: linePictureUrl }).eq('parent_line_id', realLineUserId);
                        }
                    }
                }
            }

            // Step C: หากยังไม่เคยผูกบัญชีเลย ➔ เปิด Pop-up ให้ผูกครั้งแรก
            if (!detectedRole) {
                this.isProcessingLogin = false;
                this.promptLineBinding(realLineUserId);
                return;
            }

            // Step D: พบข้อมูลที่เคยผูกไว้แล้ว ➔ บันทึก Session พร้อมรูปและเข้าสู่ระบบทันที
            this.completeLoginSession(
                studentId || teacherCode || userEmail || realLineUserId,
                dbName,
                detectedRole,
                studentId,
                teacherCode,
                userEmail,
                avatarUrl,
                'line',
                realLineUserId
            );

        } catch (err) {
            this.isProcessingLogin = false;
            document.documentElement.classList.remove('bcw-fast-redirect');
            console.error('Line Callback Processing Error:', err);
            alert('เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย LINE: ' + err.message);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    },

    // 🟢 3.1 Pop-up UI
    promptLineBinding: function(lineUserId) {
        document.documentElement.classList.remove('bcw-fast-redirect');
        const existingModal = document.getElementById('lineBindingModal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="lineBindingModal" style="position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center; background-color: rgba(0,0,0,0.75); backdrop-filter: blur(8px); padding: 16px; font-family: 'Prompt', sans-serif;">
                <div style="background: #ffffff; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); max-width: 440px; width: 100%; overflow: hidden; animation: fadeInModal 0.3s ease-out forwards;">
                    <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 24px; text-align: center; color: white;">
                        <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; border: 1px solid rgba(255,255,255,0.4);">
                            <i class="fab fa-line" style="font-size: 32px; color: #ffffff;"></i>
                        </div>
                        <h3 style="font-size: 20px; font-weight: 700; margin: 0; color: #ffffff;">ผูกบัญชี LINE เข้าใช้งาน</h3>
                        <p style="font-size: 13px; color: #a7f3d0; margin-top: 4px;">กรุณายืนยันตัวตนครั้งแรกเพื่อเข้าใช้งานระบบ</p>
                    </div>
                    <div style="padding: 20px;">
                        <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">เลือกประเภทผู้ใช้งาน</label>
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
                        <div style="margin-bottom: 16px;">
                            <label id="inputLabel" style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">กรอกรหัสนักเรียน (5 หลัก)</label>
                            <input type="text" id="bindInputCode" placeholder="เช่น 13174" style="width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #d1d5db; font-size: 14px; outline: none; box-sizing: border-box;">
                        </div>
                        <div id="modalStatusMsg" style="display: none; font-size: 13px; padding: 10px; border-radius: 10px; text-align: center; font-weight: 500; margin-bottom: 14px;"></div>
                        <div style="display: flex; gap: 10px;">
                            <button type="button" onclick="document.getElementById('lineBindingModal').remove()" style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid #d1d5db; background: #ffffff; color: #4b5563; font-weight: 600; cursor: pointer; font-size: 14px;">ยกเลิก</button>
                            <button type="button" id="btnSubmitBind" onclick="AuthService.processLineBinding('${lineUserId}')" style="flex: 2; padding: 12px; border-radius: 12px; border: none; background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: white; font-weight: 600; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">🔗 เชื่อมต่อบัญชีทันที</button>
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

    // 🟢 3.2 ประมวลผลผูกบัญชีและบันทึกลง Supabase ถาวร
    processLineBinding: async function(lineUserId) {
        const inputVal = (document.getElementById('bindInputCode').value || '').trim();
        const statusMsg = document.getElementById('modalStatusMsg');
        const btnSubmit = document.getElementById('btnSubmitBind');
        const role = this.currentSelectedRole || 'STUDENT';
        const linePic = this.pendingLineProfile?.pictureUrl || '';

        if (!inputVal) {
            statusMsg.style.display = 'block';
            statusMsg.style.background = '#fef2f2';
            statusMsg.style.color = '#dc2626';
            statusMsg.innerText = '⚠️ กรุณากรอกรหัส หรือ อีเมลยืนยันตัวตน';
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerText = '⏳ กำลังบันทึกข้อมูล...';

        const client = window.supabaseClient || window.db || window.supabase;
        if (!client) {
            alert('ไม่พบการเชื่อมต่อ Supabase');
            btnSubmit.disabled = false;
            btnSubmit.innerText = '🔗 เชื่อมต่อบัญชีทันที';
            return;
        }

        try {
            let assignedRole = role;
            let displayName = '';
            let studentId = '';
            let teacherCode = '';
            let email = '';
            let avatarUrl = linePic;

            if (role === 'STUDENT' || role === 'PARENT') {
                const { data: student, error: searchErr } = await client
                    .from('students')
                    .select('*')
                    .eq('student_id', inputVal)
                    .maybeSingle();

                if (searchErr || !student) {
                    throw new Error('ไม่พบรหัสนักเรียนนี้ในระบบ กรุณาตรวจสอบอีกครั้ง');
                }

                let updateData = {};
                if (role === 'PARENT') {
                    updateData = { parent_line_id: lineUserId };
                    if (!student.parent_avatar_url && linePic) updateData.parent_avatar_url = linePic;
                    displayName = `ผู้ปกครอง (${student.prefix || ''}${student.first_name || ''})`;
                    avatarUrl = student.parent_avatar_url || linePic;
                } else {
                    updateData = { student_line_id: lineUserId };
                    if (!student.avatar_url && linePic) updateData.avatar_url = linePic;
                    displayName = `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
                    avatarUrl = student.avatar_url || linePic;
                }

                const { error: updateErr } = await client
                    .from('students')
                    .update(updateData)
                    .eq('student_id', student.student_id);

                if (updateErr) {
                    console.error('Supabase Update Error:', updateErr);
                    throw new Error('ไม่สามารถบันทึก LINE ID ลงฐานข้อมูลได้ (ติด RLS Policy หรือ Permission)');
                }

                studentId = student.student_id;
                email = student.email || `${studentId}@buached.ac.th`;
            } 
            else if (role === 'TEACHER') {
                const inputClean = inputVal.toLowerCase();
                const { data: userRec, error: userSearchErr } = await client
                    .from('users')
                    .select('*')
                    .or(`teacher_id.eq.${inputVal},email.eq.${inputClean},user_id.eq.${inputVal}`)
                    .maybeSingle();

                if (userSearchErr || !userRec) {
                    throw new Error('ไม่พบรหัสครูหรืออีเมลนี้ในระบบ');
                }

                const updateObj = { line_user_id: lineUserId };
                if (!userRec.avatar_url && linePic) updateObj.avatar_url = linePic;

                const { error: userUpdateErr } = await client
                    .from('users')
                    .update(updateObj)
                    .eq('id', userRec.id);

                if (userUpdateErr) {
                    throw new Error('ไม่สามารถบันทึก LINE ID ของครูลงฐานข้อมูลได้');
                }

                assignedRole = (userRec.role || 'TEACHER').toUpperCase();
                displayName = userRec.full_name || userRec.name || 'คุณครู';
                teacherCode = userRec.teacher_id || userRec.user_id || '';
                email = userRec.email || '';
                avatarUrl = userRec.avatar_url || linePic;
            }
            else if (role === 'ADMIN') {
                if (inputVal.toLowerCase() !== 'kruthanadol@buached.ac.th') {
                    throw new Error('อีเมลนี้ไม่มีสิทธิ์ใช้งานในบทบาท Admin');
                }

                const updateObj = { line_user_id: lineUserId };
                if (linePic) updateObj.avatar_url = linePic;

                await client.from('users').update(updateObj).eq('email', inputVal.toLowerCase());
                assignedRole = 'ADMIN';
                displayName = 'Thanadol Kamsamer';
                email = inputVal;
            }

            localStorage.setItem('bcw_bound_identity', inputVal);
            localStorage.setItem('bcw_bound_role', assignedRole);
            localStorage.setItem('bcw_bound_line_id', lineUserId);

            statusMsg.style.display = 'block';
            statusMsg.style.background = '#ecfdf5';
            statusMsg.style.color = '#047857';
            statusMsg.innerText = '✅ ผูกบัญชี LINE สำเร็จ! กำลังเข้าสู่ระบบ...';

            setTimeout(() => {
                const modal = document.getElementById('lineBindingModal');
                if (modal) modal.remove();
                this.completeLoginSession(inputVal, displayName, assignedRole, studentId, teacherCode, email, avatarUrl, 'line', lineUserId);
            }, 500);

        } catch (err) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = '🔗 เชื่อมต่อบัญชีทันที';
            statusMsg.style.display = 'block';
            statusMsg.style.background = '#fef2f2';
            statusMsg.style.color = '#dc2626';
            statusMsg.innerText = '❌ ' + err.message;
        }
    },

    // 🟢 4. Password Login
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
            let lineUserId = '';

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
                    avatarUrl = userRec.avatar_url || userRec.photo_url || '';
                    lineUserId = userRec.line_user_id || '';
                }
            } catch (e) {
                if (e.message === "รหัสผ่านไม่ถูกต้อง") throw e;
            }

            if (!detectedRole) {
                try {
                    let studentQuery = client.from('students').select('*');
                    let extractedStudentId = inputLower.includes('@') ? inputLower.split('@')[0] : input;

                    if (inputLower.includes('@')) {
                        studentQuery = studentQuery.or(`email.eq.${inputLower},student_google_email.eq.${inputLower},student_id.eq.${extractedStudentId}`);
                    } else {
                        studentQuery = studentQuery.eq('student_id', input);
                    }

                    const { data: student } = await studentQuery.maybeSingle();

                    if (student) {
                        const studentIdStr = String(student.student_id || '').trim();
                        const parentPassStr = String(student.parent_password || '').trim();

                        if (parentPassStr && parentPassStr === pass) {
                            detectedRole = 'PARENT';
                        } else if (pass === studentIdStr || pass === '123456') {
                            detectedRole = 'STUDENT';
                        } else {
                            throw new Error("รหัสผ่านไม่ถูกต้อง");
                        }

                        const prefix = (student.prefix || '').trim();
                        const firstName = (student.first_name || '').trim();
                        const lastName = (student.last_name || '').trim();
                        
                        dbName = (detectedRole === 'PARENT') 
                            ? `ผู้ปกครอง (${prefix}${firstName})`
                            : `${prefix}${firstName} ${lastName}`.trim() || 'นักเรียน';

                        userEmail = student.email || student.student_google_email || `${studentIdStr}@buached.ac.th`;
                        studentId = studentIdStr;
                        avatarUrl = (detectedRole === 'PARENT') ? (student.parent_avatar_url || '') : (student.avatar_url || '');
                        lineUserId = (detectedRole === 'PARENT') ? (student.parent_line_id || '') : (student.student_line_id || '');
                    }
                } catch (e) {
                    if (e.message === "รหัสผ่านไม่ถูกต้อง") throw e;
                }
            }

            if (!detectedRole) {
                throw new Error("ไม่พบข้อมูลผู้ใช้งาน หรือรหัสประจำตัวนี้ในระบบ");
            }

            this.completeLoginSession(studentId || teacherCode || input, dbName, detectedRole, studentId, teacherCode, userEmail, avatarUrl, 'password', lineUserId);

        } catch (err) {
            this.isProcessingLogin = false;
            console.error('Direct Login Error:', err);
            alert('เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + err.message);
        }
    },

    // 🟢 5. Google SSO Callback Handler (ดึงรูป ssoAvatar และบันทึกลง Session + DB)
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
            let finalAvatar = ssoAvatar;
            let lineUserId = '';

            if (email === 'kruthanadol@buached.ac.th') {
                detectedRole = 'ADMIN';
                dbName = ssoUser.user_metadata?.full_name || 'Thanadol Kamsamer';
                if (client && ssoAvatar) {
                    try {
                        await client.from('users').update({ avatar_url: ssoAvatar }).eq('email', email);
                    } catch (e) {}
                }
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
                        dbName = userRec.full_name || userRec.name || userRec.display_name || ssoUser.user_metadata?.full_name || '';
                        teacherCode = userRec.teacher_id || userRec.teacher_code || '';
                        finalAvatar = userRec.avatar_url || userRec.photo_url || ssoAvatar;
                        lineUserId = userRec.line_user_id || '';

                        if (!userRec.avatar_url && ssoAvatar) {
                            await client.from('users').update({ avatar_url: ssoAvatar }).eq('id', userRec.id);
                        }
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
                        finalAvatar = teacher.avatar_url || teacher.photo_url || ssoAvatar;
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
                        finalAvatar = student.avatar_url || ssoAvatar;
                        lineUserId = student.student_line_id || '';

                        if (!student.avatar_url && ssoAvatar) {
                            await client.from('students').update({ avatar_url: ssoAvatar }).eq('student_id', student.student_id);
                        }
                    }
                } catch (e) { console.warn('Student Query Error:', e); }
            }

            if (!detectedRole) {
                dbName = ssoUser.user_metadata?.full_name || ssoUser.user_metadata?.name || (email ? email.split('@')[0] : 'ผู้ใช้งาน');
                detectedRole = email.endsWith('@buached.ac.th') ? 'STUDENT' : 'PARENT';
            }

            this.completeLoginSession(
                studentId || teacherCode || userId,
                dbName,
                detectedRole,
                studentId,
                teacherCode,
                email,
                finalAvatar,
                'google',
                lineUserId
            );

        } catch (err) {
            console.error('handlePostLogin Error:', err);
            this.isProcessingLogin = false;
            document.documentElement.classList.remove('bcw-fast-redirect');
        }
    },

    // 🟢 6. บันทึก Session สำเร็จ (ส่งรูป avatarUrl, ID, lineUserId และ Role ครบทุกฟิลด์)
    completeLoginSession: function(id, name, role, studentId, teacherId, email, avatarUrl = '', provider = 'line', lineUserId = '') {
        const boundId = id || studentId || teacherId;
        
        if (boundId) {
            localStorage.setItem('bcw_bound_identity', boundId);
            localStorage.setItem('bcw_bound_role', role);
        }

        const userProfile = {
            id: boundId,
            name: name,
            role: role,
            email: email,
            avatar: avatarUrl || '',
            avatar_url: avatarUrl || '',
            photo_url: avatarUrl || '',
            teacherId: teacherId || '',
            teacher_id: teacherId || '',
            studentId: studentId || '',
            student_id: studentId || '',
            lineUserId: lineUserId || '',
            provider: provider
        };

        const sessionStr = JSON.stringify(userProfile);
        localStorage.setItem('bcw_user_session', sessionStr);
        sessionStorage.setItem('bcw_user_session', sessionStr);

        this.redirectToRolePage(role);
    },

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
