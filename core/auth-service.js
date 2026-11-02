// core/auth-service.js
(function() {
    const AuthService = {
        // 1. Google SSO Login
        async loginWithGoogle() {
            try {
                const client = window.supabase || window.db;
                if (!client || !client.auth) {
                    throw new Error('ยังไม่ได้เชื่อมต่อ Supabase SDK');
                }

                const currentOrigin = window.location.origin;
                const pathname = window.location.pathname;
                const basePath = pathname.substring(0, pathname.lastIndexOf('/'));
                const targetUrl = `${currentOrigin}${basePath}/landing.html`;

                const { data, error } = await client.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: targetUrl
                    }
                });
                if (error) throw error;
            } catch (err) {
                console.error('Google Login Error:', err.message);
                alert('เกิดข้อผิดพลาดในการเชื่อมต่อ Google: ' + err.message);
            }
        },

        // 2. LINE Login
        async loginWithLine(liffId) {
            try {
                alert('ระบบ LINE Login กำลังเตรียมความพร้อม');
            } catch (err) {
                console.error('LINE Login Error:', err.message);
            }
        },

        // 3. Check Session & Domain
        async checkSession() {
            try {
                const client = window.supabase || window.db;
                if (!client || !client.auth) return null;

                const { data: { session }, error } = await client.auth.getSession();
                if (error || !session) return null;

                const email = session.user?.email || '';
                if (email && !email.endsWith('@buached.ac.th')) {
                    alert('อนุญาตให้เข้าใช้งานเฉพาะอีเมลองค์กร @buached.ac.th เท่านั้น');
                    await this.logout();
                    return null;
                }

                return session;
            } catch (err) {
                console.error('Check Session Error:', err);
                return null;
            }
        },

        // 4. Get User Profile & Role
        async getUserProfile(user) {
            try {
                const client = window.supabase || window.db;
                if (!client) return { role: 'student' };

                const userId = typeof user === 'object' ? user.id : user;
                const userEmail = typeof user === 'object' ? (user.email || '') : user;

                // ดึงจาก auth_identities
                let { data } = await client
                    .from('auth_identities')
                    .select('*')
                    .or(`internal_user_id.eq.${userId},provider_user_id.eq.${userEmail},provider_user_id.eq.${userId}`)
                    .maybeSingle();

                if (data && data.role) return data;

                // Fallback: ตรวจสอบจากครู
                if (userEmail) {
                    const { data: teacherData } = await client
                        .from('teachers')
                        .select('teacher_id, teacher_name, email, role')
                        .eq('email', userEmail)
                        .maybeSingle();

                    if (teacherData) {
                        return {
                            internal_user_id: teacherData.teacher_id,
                            display_name: teacherData.teacher_name,
                            role: teacherData.role || (userEmail === 'kruthanadol@buached.ac.th' ? 'admin' : 'teacher')
                        };
                    }

                    // Fallback: ตรวจสอบจากนักเรียน
                    const { data: studentData } = await client
                        .from('students')
                        .select('student_id, title, first_name, last_name, email')
                        .eq('email', userEmail)
                        .maybeSingle();

                    if (studentData) {
                        return {
                            internal_user_id: studentData.student_id,
                            display_name: `${studentData.title || ''}${studentData.first_name} ${studentData.last_name}`.trim(),
                            role: 'student'
                        };
                    }
                }

                if (userEmail === 'kruthanadol@buached.ac.th') {
                    return { role: 'admin', display_name: 'ครูธนดล คำเสนอ' };
                } else if (userEmail === 'info@buached.ac.th') {
                    return { role: 'teacher', display_name: 'ประชาสัมพันธ์ บัวเชดวิทยา' };
                }

                return { role: 'student' };
            } catch (err) {
                console.error('Get Profile Error:', err.message);
                return { role: 'student' };
            }
        },

        // 5. Handle Role Routing
        async handleRoleRouting(session) {
            if (!session) {
                if (!window.location.pathname.endsWith('login.html')) {
                    window.location.href = 'login.html';
                }
                return null;
            }

            const profile = await this.getUserProfile(session.user);
            const userRole = (profile?.role || 'student').toLowerCase().trim();

            localStorage.setItem('user_role', userRole);
            localStorage.setItem('user_email', session.user.email);

            if (!window.location.pathname.endsWith('landing.html')) {
                window.location.href = 'landing.html';
            }

            return { session, role: userRole, profile };
        },

        // 6. Logout
        async logout() {
            try {
                const client = window.supabase || window.db;
                if (client && client.auth) {
                    await client.auth.signOut();
                }
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace('login.html');
            } catch (err) {
                console.error('Logout Error:', err);
                window.location.replace('login.html');
            }
        }
    };

    // ผูกเข้ากับ Global Window
    window.AuthService = AuthService;
})();
