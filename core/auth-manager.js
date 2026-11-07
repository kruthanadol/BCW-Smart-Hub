// core/auth-manager.js
const AuthManager = {
    // 🟢 1. ดึงข้อมูล User Session (รองรับทั้ง localStorage และ sessionStorage)
    getCurrentUser: function() {
        try {
            const raw = localStorage.getItem('bcw_user_session') || sessionStorage.getItem('bcw_user_session');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.role) return parsed;
            }
        } catch (e) {
            console.warn("AuthManager: Read session error", e);
        }
        return null;
    },

    // 🟢 2. ดึง Path หน้า login ให้ถูกโครงสร้าง (แก้ปัญหา GitHub Pages Absolute Path)
    getLoginUrl: function() {
        const currentPath = window.location.pathname;
        const pathSegments = currentPath.split('/').filter(Boolean);
        let repoPrefix = '';

        // ถ้าอยู่บน github.io ให้ติดชื่อ repo ไปด้วย
        if (window.location.hostname.includes('github.io') && pathSegments.length > 0) {
            repoPrefix = '/' + pathSegments[0];
        }
        return repoPrefix + '/login.html';
    },

    /**
     * 🟢 3. Auth Guard ดักสิทธิ์เข้าถึงหน้าเว็บตามเงื่อนไขของโรงเรียน
     */
    requireAuth: function(allowedRoles = [], customRedirectUrl = null) {
        const user = this.getCurrentUser();
        const targetLoginUrl = customRedirectUrl || this.getLoginUrl();

        // 1. ถ้ายังไม่ได้ล็อกอิน ให้ดีดกลับไปหน้า Login ตาม Path ที่ถูกต้อง
        if (!user || !user.role) {
            console.warn('🔒 Auth Guard: ไม่พบ Session การเข้าสู่ระบบ');
            if (!window.location.pathname.endsWith('/login.html')) {
                window.location.replace(targetLoginUrl);
            }
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
            if (window.AuthService && typeof AuthService.redirectToRolePage === 'function') {
                AuthService.redirectToRolePage(userRole);
            } else {
                window.location.replace(targetLoginUrl);
            }
            return null;
        }

        return user;
    },

    // 🟢 4. Logout ล้างค่าและย้ายกลับหน้า Login
    logout: function(customRedirectUrl = null) {
        localStorage.clear();
        sessionStorage.clear();
        
        const client = window.supabaseClient || window.db || window.supabase;
        if (client && client.auth) {
            try { client.auth.signOut(); } catch (e) {}
        }

        const targetLoginUrl = customRedirectUrl || this.getLoginUrl();
        window.location.replace(targetLoginUrl);
    }
};

window.AuthManager = AuthManager;
window.getCurrentUser = () => AuthManager.getCurrentUser();
window.requireAuth = (roles, url) => AuthManager.requireAuth(roles, url);
window.logoutUser = (url) => AuthManager.logout(url);
