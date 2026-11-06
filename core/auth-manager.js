// core/auth-manager.js
const AuthManager = {
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
     * 🟢 Auth Guard ดักสิทธิ์เข้าถึงหน้าเว็บตามเงื่อนไขของโรงเรียน
     */
    requireAuth: function(allowedRoles = [], redirectUrl = '/login.html') {
        const user = this.getCurrentUser();

        // 1. ถ้ายังไม่ได้ล็อกอิน ให้ดีดกลับไปหน้า Login
        if (!user || !user.role) {
            console.warn('🔒 Auth Guard: ไม่พบ Session การเข้าสู่ระบบ');
            window.location.replace(redirectUrl);
            return null;
        }

        const userRole = user.role.toUpperCase();
        const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

        // 👑 ผู้บริหาร / แอดมิน ได้สิทธิ์ผ่านเข้าได้ทุกหน้าเสมอ (Power Users)
        const isPowerUser = ['ADMIN', 'SUPERADMIN', 'EXECUTIVE'].includes(userRole);

        if (isPowerUser) {
            return user;
        }

        // 2. ตรวจเช็กสิทธิ์สำหรับบทบาทอื่นๆ
        if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole)) {
            alert('🔒 คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            // หากพยายามแอบเข้าหน้าอื่นโดยไม่มีสิทธิ์ ให้ส่งกลับไปหน้าประจำบทบาทของตนเอง
            AuthService.redirectToRolePage(userRole);
            return null;
        }

        return user;
    },

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
