// core/auth-manager.js - Centralized Auth Manager (Unified Auth Edition)
const AuthManager = {
    SESSION_KEY: 'bcw_user_session',

    // 🟢 1. คำนวณ Root Path ของ GitHub Pages ให้แม่นยำ
    getRepoPrefix: function() {
        const hostname = window.location.hostname;
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        if (hostname.includes('github.io') && pathSegments.length > 0) {
            return '/' + pathSegments[0];
        }
        return '';
    },

    // 🟢 2. ดึง URL หน้า Login
    getLoginUrl: function() {
        return this.getRepoPrefix() + '/login.html';
    },

    // 🟢 3. ดึงข้อมูล User ปัจจุบันจาก LocalStorage / SessionStorage
    getCurrentUser: function() {
        try {
            const raw = localStorage.getItem(this.SESSION_KEY) || sessionStorage.getItem(this.SESSION_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.role || parsed.id)) return parsed;
            }
        } catch (e) {
            console.warn("AuthManager: Read Session Error", e);
        }
        return null;
    },

    // 🟢 4. บันทึก Session เข้าสู่ระบบแบบศูนย์กลาง (เพิ่มเพื่อรองรับ Unified Auth)
    setSession: function(userProfile) {
        if (!userProfile) return;
        
        try {
            const formattedProfile = {
                id: userProfile.id || userProfile.studentId || userProfile.teacherId || '',
                name: userProfile.name || userProfile.full_name || 'ผู้ใช้งานระบบ',
                email: (userProfile.email || '').toLowerCase().trim(),
                role: (userProfile.role || 'STUDENT').toUpperCase(),
                avatar: userProfile.avatar || userProfile.avatar_url || '',
                teacherId: userProfile.teacherId || (userProfile.role === 'TEACHER' ? userProfile.id : ''),
                studentId: userProfile.studentId || (userProfile.role === 'STUDENT' ? userProfile.id : ''),
                provider: userProfile.provider || 'direct',
                loginAt: new Date().toISOString()
            };

            const sessionStr = JSON.stringify(formattedProfile);
            localStorage.setItem(this.SESSION_KEY, sessionStr);
            sessionStorage.setItem(this.SESSION_KEY, sessionStr);
            return formattedProfile;
        } catch (e) {
            console.error("AuthManager: Set Session Error", e);
        }
    },

    // 🟢 5. ระบบตรวจสิทธิ์แบบ Silent (ไม่เด้ง Popup Alert เพื่อป้องกันวงจร SSO Loop)
    requireAuth: function(allowedRoles = [], customRedirectUrl = null) {
        const user = this.getCurrentUser();
        const targetLoginUrl = customRedirectUrl || this.getLoginUrl();
        const currentPath = window.location.pathname;

        // ถ้าไม่มี Session ให้พาไปหน้า Login เงียบๆ
        if (!user || (!user.role && !user.id)) {
            console.warn('🔒 Auth Guard: ไม่พบ Session การเข้าสู่ระบบ');
            if (!currentPath.endsWith('/login.html')) {
                window.location.replace(targetLoginUrl);
            }
            return null;
        }

        const userRole = (user.role || 'STUDENT').toUpperCase();
        const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

        // ให้สิทธิ์ Admin, SuperAdmin, Executive ผ่านได้ทุกหน้าเสมอ
        if (['ADMIN', 'SUPERADMIN', 'EXECUTIVE'].includes(userRole)) {
            return user;
        }

        // ถ้าสิทธิ์ไม่ตรง ให้ดีดไปยังหน้าประจำบทบาทของเขาเงียบๆ
        if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole)) {
            console.warn(`🔒 Access Denied: Role ${userRole} ไม่มีสิทธิ์เข้าถึงหน้านี้`);
            if (window.AuthService && typeof AuthService.redirectToRolePage === 'function') {
                AuthService.redirectToRolePage(userRole);
            } else {
                window.location.replace(targetLoginUrl);
            }
            return null;
        }

        return user;
    },

    // 🟢 6. ออกจากระบบ และล้าง Memory เกลี้ยง
    logout: function(customRedirectUrl = null) {
        localStorage.removeItem(this.SESSION_KEY);
        sessionStorage.removeItem(this.SESSION_KEY);
        localStorage.clear();
        sessionStorage.clear();

        try {
            const client = window.supabaseClient || window.db || window.supabase;
            if (client && client.auth) client.auth.signOut();
        } catch (e) {
            console.warn("Logout error:", e);
        }

        const targetLoginUrl = customRedirectUrl || this.getLoginUrl();
        window.location.replace(targetLoginUrl);
    }
};

// ส่งออกให้เรียกใช้งานแบบ Global
window.AuthManager = AuthManager;
window.getCurrentUser = () => AuthManager.getCurrentUser();
window.requireAuth = (roles, url) => AuthManager.requireAuth(roles, url);
window.logoutUser = (url) => AuthManager.logout(url);
