// core/auth-service.js

class AuthService {
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
                    localStorage.setItem('user_role', 'parent');
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
                return { role: 'admin', display_name: 'ครูธนดล คำเสนอ' };
            }

            // ค้นหาจาก auth_identities
            let { data } = await client
                .from('auth_identities')
                .select('*')
                .or(`internal_user_id.eq.${userId},provider_user_id.eq.${userEmail}`)
                .maybeSingle();

            if (data && data.role) return data;

            return { role: 'teacher', display_name: userEmail ? userEmail.split('@')[0] : 'ผู้ใช้งาน' };
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
