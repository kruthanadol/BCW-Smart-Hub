/**
 * BCW SMART HUB - Core Authentication Service
 * รองรับ Dual-Login (Google SSO + LINE Login) และ Session Management
 */

const AuthService = {

    /**
     * 1. เข้าสู่ระบบด้วย Google SSO (สำหรับครู/นักเรียน)
     */
// ในไฟล์ core/auth-service.js
async loginWithGoogle() {
    try {
        const client = window.supabase || window.db;
        if (!client || !client.auth) {
            throw new Error('ยังไม่ได้เชื่อมต่อ Supabase SDK');
        }

        // ดึง Base URL ของเว็บไซต์ปัจจุบันอัตโนมัติ (รองรับทั้ง localhost และ GitHub Pages)
        const currentOrigin = window.location.origin;
        const pathname = window.location.pathname;
        
        // ตัดชื่อไฟล์ /login.html ออกเพื่อให้ได้ Path โฟลเดอร์หลัก
        const basePath = pathname.substring(0, pathname.lastIndexOf('/'));
        
        // กำหนดปลายทางเป็น landing.html ในโฟลเดอร์เดียวกัน
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
}

    /**
     * 2. เข้าสู่ระบบด้วย LINE Login / LIFF (สำหรับผู้ปกครอง/มือถือ)
     * @param {string} liffId - ID ของ LIFF App ที่ตั้งค่าไว้ใน LINE Developers
     */
    async loginWithLine(liffId) {
        try {
            if (typeof liff !== 'undefined') {
                await liff.init({ liffId });
                if (!liff.isLoggedIn()) {
                    liff.login();
                } else {
                    // หากล็อกอินใน LINE แล้ว ให้ดึงข้อมูลโปรไฟล์ไปใช้งานต่อ
                    const profile = await liff.getProfile();
                    return profile;
                }
            } else {
                throw new Error('LINE SDK (LIFF) ยังไม่ได้ถูกโหลดในหน้านี้');
            }
        } catch (err) {
            console.error('LINE Login Error:', err.message);
            alert('เกิดข้อผิดพลาดในการล็อกอินผ่าน LINE: ' + err.message);
        }
    },

    /**
     * 3. ตรวจสอบ Session และสิทธิ์การใช้งาน (ใช้เรียกในทุกๆ หน้าพอร์ตัล)
     * @returns {Object|null} ข้อมูล Session หรือ null หากไม่ได้ล็อกอิน
     */
    async checkSession() {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error || !session) {
                return null;
            }

            const userEmail = session.user.email || '';

            // ดักเช็กเฉพาะกรณีล็อกอินผ่าน Google ให้ใช้อีเมลองค์กรเท่านั้น
            if (session.user.app_metadata.provider === 'google') {
                if (!userEmail.endsWith('@buached.ac.th')) {
                    await this.logout();
                    alert('ระบบอนุญาตให้เข้าใช้งานเฉพาะอีเมลโรงเรียน (@buached.ac.th) เท่านั้น');
                    window.location.href = '../login-app/login.html';
                    return null;
                }
            }

            return session;
        } catch (err) {
            console.error('Session Check Error:', err.message);
            return null;
        }
    },

    /**
     * 4. ดึงข้อมูลบทบาทและสิทธิ์ผู้ใช้งานจากฐานข้อมูล Supabase
     * @param {string} identifier - อีเมล หรือ provider_user_id
     * @returns {Object} ข้อมูลผู้ใช้และบทบาท (role)
     */
    async getUserProfile(identifier) {
        try {
            // ค้นหาจากตารางผูกตัวตน auth_identities ที่เราสร้างไว้ใน Phase 1
            const { data, error } = await supabase
                .from('auth_identities')
                .select('*')
                .eq('provider_user_id', identifier)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Get Profile Error:', err.message);
            return null;
        }
    },

    /**
     * 5. ออกจากระบบ (Logout)
     */
    async logout() {
        try {
            // 1. Sign out จาก Supabase Auth
            await supabase.auth.signOut();
            
            // 2. Sign out จาก LINE LIFF (ถ้ามี)
            if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
                liff.logout();
            }

            // 3. กลับไปยังหน้า Login
            window.location.replace('../login-app/login.html');
        } catch (err) {
            console.error('Logout Error:', err.message);
        }
    }
};

// Export โมดูลให้หน้าอื่นๆ เรียกใช้
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthService;
}
