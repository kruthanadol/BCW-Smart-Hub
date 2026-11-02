// core/auth-service.js
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

    // 3. Check Active Session & Domain Gatekeeper
    async checkSession() {
        try {
            const client = window.supabase || window.db;
            if (!client || !client.auth) return null;

            const { data: { session }, error } = await client.auth.getSession();
            if (error || !session) return null;

            // Domain Check (@buached.ac.th)
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

    // 4. Fetch User Profile & Role from auth_identities
    async getUserProfile(identifier) {
        try {
            const client = window.supabase || window.db;
            if (!client) return null;

            const { data, error } = await client
                .from('auth_identities')
                .select('*')
                .or(`email.eq.${identifier},provider_user_id.eq.${identifier}`)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Get Profile Error:', err.message);
            return null;
        }
    },

    // 5. Logout
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

// ผูกเข้ากับ window Object สำหรับเรียกใช้งานทั่วระบบ
window.AuthService = AuthService;
