// core/auth-manager.js
const AuthManager = {
    // อ่าน Session กลางคีย์เดียว
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

    // 🟢 Auth Guard ดักสิทธิ์เข้าหน้าเว็บ
    requireAuth: function(allowedRoles = [], redirectUrl = '/login.html') {
        const user = this.getCurrentUser();

        // 1. ไม่มี Session ให้ดีดไปหน้า Login
        if (!user || !user.role) {
            console.warn('🔒 Auth Guard: ไม่พบ Session การเข้าสู่ระบบ');
            window.location.replace(redirectUrl);
            return null;
        }

        const userRole = user.role.toUpperCase();
        const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());
        const isPowerUser = ['ADMIN', 'SUPERADMIN', 'EXECUTIVE'].includes(userRole);

        // 2. ถ้าไม่มีสิทธิ์ในหน้านี้ ให้ดีดกลับหน้า Login
        if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole) && !isPowerUser) {
            alert('🔒 คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            window.location.replace(redirectUrl);
            return null;
        }

        return user;
    },

    // ออกจากระบบ
    logout: function(redirectUrl = '/login.html') {
        localStorage.clear();
        sessionStorage.clear();
        
        const client = window.supabaseClient || window.db || window.supabase;
        if (client && client.auth) {
            try { client.auth.signOut(); } catch (e) {}
        }
        window.location.replace(redirectUrl);
    }
};

window.AuthManager = AuthManager;
window.getCurrentUser = () => AuthManager.getCurrentUser();
window.requireAuth = (roles, url) => AuthManager.requireAuth(roles, url);
window.logoutUser = () => AuthManager.logout();
