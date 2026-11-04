// core/auth-manager.js

const AuthManager = {
    /**
     * ดึงข้อมูลผู้ใช้งานปัจจุบันจาก Session กลาง
     */
    getCurrentUser: function() {
        try {
            const raw = localStorage.getItem('bcw_user_session');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.role) return parsed;
            }
        } catch (e) {
            console.warn("AuthManager: Read session error", e);
        }
        return null;
    },

    /**
     * Auth Guard สำหรับตรวจสอบสิทธิ์การเข้าถึงหน้าเว็บ
     * @param {Array} allowedRoles บทบาทที่อนุญาต เช่น ['ADMIN', 'TEACHER']
     * @param {String} redirectUrl หน้าที่จะดีดไปถ้าไม่มีสิทธิ์
     */
    requireAuth: function(allowedRoles = [], redirectUrl = '/login.html') {
        const user = this.getCurrentUser();

        if (!user || !user.role) {
            console.warn('🔒 Auth Guard: ไม่พบ Session การเข้าสู่ระบบ');
            window.location.replace(redirectUrl);
            return null;
        }

        const userRole = user.role.toUpperCase();
        const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());
        const isPowerUser = ['ADMIN', 'SUPERADMIN', 'EXECUTIVE'].includes(userRole);

        if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole) && !isPowerUser) {
            alert('🔒 คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            window.location.replace(redirectUrl);
            return null;
        }

        return user;
    },

    /**
     * ออกจากระบบ ล้างค่า Session และ Sign Out
     */
    logout: function(redirectUrl = '/login.html') {
        localStorage.clear();
        sessionStorage.clear();
        
        const client = window.supabase || window.db;
        if (client && client.auth) {
            try { client.auth.signOut(); } catch (e) {}
        }
        window.location.replace(redirectUrl);
    }
};

if (typeof window !== 'undefined') {
    window.AuthManager = AuthManager;
    window.getCurrentUser = () => AuthManager.getCurrentUser();
    window.requireAuth = (roles, url) => AuthManager.requireAuth(roles, url);
    window.logoutUser = () => AuthManager.logout();
}
