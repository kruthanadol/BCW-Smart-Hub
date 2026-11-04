// core/auth-service.js

class AuthService {
    // 💾 0. Centralized Session Management (เพิ่มใหม่ตาม Phase 1)
    static setUserSession(userData) {
        if (!userData) return null;

        const profile = {
            id: userData.id || userData.teacher_id || '',
            name: userData.full_name || userData.name || userData.teacher_name || userData.display_name || 'ผู้ใช้งานระบบ',
            role: (userData.role || 'TEACHER').toUpperCase(),
            avatar: userData.avatar_url || userData.photo_url || userData.picture || '',
            email: userData.email || ''
        };

        // เซฟลงคีย์หลักประจำระบบ BCW Smart Hub
        localStorage.setItem('bcw_user_profile', JSON.stringify(profile));

        // เซฟคีย์มาตรฐานสำรองเพื่อความชัวร์ในการดึงข้อมูลแบบดั้งเดิม
        localStorage.setItem('user_name', profile.name);
        localStorage.setItem('user_role', profile.role);
        if (profile.avatar) {
            localStorage.setItem('user_avatar', profile.avatar);
        } else {
            localStorage.removeItem('user_avatar');
        }

        return profile;
    }

    static getCurrentUser() {
        try {
            const profileStr = localStorage.getItem('bcw_user_profile');
            if (profileStr) {
                return JSON.parse(profileStr);
            }
        } catch (e) {
            console.warn("AuthService: Error parsing local profile", e);
        }

        // Fallback: ดึงคีย์เดี่ยวกรณีไม่มีคีย์หลัก
        const name = localStorage.getItem('user_name');
        if (name && name !== 'undefined' && name !== 'null') {
            return {
                id: '',
                name: name,
                role: (localStorage.getItem('user_role') || 'TEACHER').toUpperCase(),
                avatar: localStorage.getItem('user_avatar') || '',
                email: ''
            };
        }
        return null;
    }

    // 1. Google SSO Login
    static async loginWithGoogle() {
        try {
            const client = window.supabase || window.db;
            if (!client || !client.auth) {
                throw new Error('ยังไม่ได้เชื่อมต่อ Supabase SDK');
            }

            const currentOrigin = window.location.origin;
            const pathname = window.location.pathname;
            const basePath = pathname.substring(0, pathname.lastIndexOf('/'));
            const targetUrl = `${currentOrigin}${basePath}/landing.html`;

            console.log('🔗 Redirecting to:', targetUrl);

            const { data, error } = await client.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: targetUrl,
                    queryParams: {
                        prompt: 'select_account'
                    }
                }
            });
            if (error) throw error;
        } catch (err) {
            console.error('Google Login Error:', err.message);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ Google: ' + err.message);
        }
    }

    // 2. LINE Login (โครงสร้างเตรียมพร้อมสำหรับ LIFF / Provider)
    static async loginWithLine(liffId) {
        try {
            if (!liffId || liffId === 'YOUR-LIFF-ID') {
                alert('ระบบ LINE Login อยู่ระหว่างการเตรียมความพร้อม (กรุณาตั้งค่า LIFF ID)');
                return;
            }

            if (typeof liff !== 'undefined') {
                await liff.init({ liffId: liffId });
                if (!liff.isLoggedIn()) {
                    liff.login({ redirectUri: window.location.href });
                } else {
                    const profile = await liff.getProfile();
                    this.setUserSession({
                        name: profile.displayName,
                        role: 'parent',
                        avatar: profile.pictureUrl
                    });
                    localStorage.setItem('line_user_id', profile.userId);
                    window.location.replace('landing.html');
                }
            } else {
                alert('ระบบ LINE Login กำลังเตรียมความพร้อม');
            }
        } catch (err) {
            console.error('LINE Login Error:', err.message);
        }
    }

    // 3. Check Session & Verification
    static async checkSession() {
        try {
            const client = window.supabase || window.db;
            if (!client || !client.auth) return null;

            const { data: { session }, error } = await client.auth.getSession();
            
            if (error) {
                console.error('Session Error:', error.message);
                return null;
            }

            if (!session) {
                console.warn('ไม่พบ Session ปัจจุบัน');
                return null;
            }

            console.log('✅ พบ Session ผู้ใช้:', session.user.email);
            return session;
        } catch (err) {
            console.error('Check Session Error:', err);
            return null;
        }
    }

    // 4. Get User Profile & Role Lookup
    static async getUserProfile(user) {
        try {
            const client = window.supabase || window.db;
            if (!client) return { role: 'student' };

            const userId = typeof user === 'object' ? user.id : user;
            const userEmail = typeof user === 'object' ? (user.email || '') : user;

            // Admin Hardcoded Fallback
            if (userEmail === 'kruthanadol@buached.ac.th') {
                const adminProfile = { role: 'admin', display_name: 'ครูธนดล คำเสนอ', full_name: 'ครูธนดล คำเสนอ' };
                this.setUserSession(adminProfile);
                return adminProfile;
            }

            // ค้นหาจาก auth_identities
            let { data } = await client
                .from('auth_identities')
                .select('*')
                .or(`internal_user_id.eq.${userId},provider_user_id.eq.${userEmail}`)
                .maybeSingle();

            if (data && data.role) {
                this.setUserSession(data);
                return data;
            }

            const fallbackProfile = { 
                role: 'teacher', 
                display_name: userEmail ? userEmail.split('@')[0] : 'ผู้ใช้งาน',
                full_name: userEmail ? userEmail.split('@')[0] : 'ผู้ใช้งาน'
            };
            return fallbackProfile;
        } catch (err) {
            console.error('Get Profile Error:', err.message);
            return { role: 'teacher' };
        }
    }

    // 5. Logout
    static async logout() {
        try {
            const client = window.supabase || window.db;
            if (client && client.auth) {
                await client.auth.signOut();
            }
        } catch (e) {
            console.warn('Logout warning:', e);
        }
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('login.html');
    }
}

// ผูกเข้ากับ Global Window Object
window.AuthService = AuthService;
