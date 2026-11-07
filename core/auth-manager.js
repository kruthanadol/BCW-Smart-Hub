// core/auth-manager.js
const AuthManager = {
    getLoginUrl: function() {
        const currentPath = window.location.pathname;
        const pathSegments = currentPath.split('/').filter(Boolean);
        let repoPrefix = '';

        if (window.location.hostname.includes('github.io') && pathSegments.length > 0) {
            repoPrefix = '/' + pathSegments[0];
        }
        return repoPrefix + '/login.html';
    },

    getCurrentUser: function() {
        try {
            const raw = localStorage.getItem('bcw_user_session') || sessionStorage.getItem('bcw_user_session');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.role) return parsed;
            }
        } catch (e) {
            console.warn("AuthManager: Read Session Error", e);
        }
        return null;
    },

    requireAuth: function(allowedRoles = [], customRedirectUrl = null) {
        const user = this.getCurrentUser();
        const targetLoginUrl = customRedirectUrl || this.getLoginUrl();
        const currentPath = window.location.pathname;

        if (!user || !user.role) {
            console.warn('🔒 Auth Guard: ไม่พบ Session การเข้าสู่ระบบ');
            if (!currentPath.endsWith('/login.html')) {
                window.location.replace(targetLoginUrl);
            }
            return null;
        }

        const userRole = user.role.toUpperCase();
        const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

        if (['ADMIN', 'SUPERADMIN', 'EXECUTIVE'].includes(userRole)) {
            return user;
        }

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

    logout: function(customRedirectUrl = null) {
        localStorage.clear();
        sessionStorage.clear();
        
        try {
            const client = window.supabaseClient || window.db || window.supabase;
            if (client && client.auth) client.auth.signOut();
        } catch (e) {}

        const targetLoginUrl = customRedirectUrl || this.getLoginUrl();
        window.location.replace(targetLoginUrl);
    }
};

window.AuthManager = AuthManager;
window.getCurrentUser = () => AuthManager.getCurrentUser();
window.requireAuth = (roles, url) => AuthManager.requireAuth(roles, url);
window.logoutUser = (url) => AuthManager.logout(url);
