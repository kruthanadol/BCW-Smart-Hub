// core/auth-manager.js

/**
 * ===================================================
 * BCW SMART HUB - CENTRAL AUTH MANAGER ENGINE
 * ===================================================
 */

const AuthManager = {

    // 💾 1. บันทึก Session มาตรฐานเข้า LocalStorage ชุดเดียว
    setUserSession: function(profileData) {
        if (!profileData) return null;

        const roleUpper = (profileData.role || 'STUDENT').toUpperCase().trim();
        
        const normalizedProfile = {
            id: profileData.id || profileData.teacher_id || profileData.student_id || '',
            userId: profileData.id || profileData.teacher_id || profileData.student_id || '',
            teacherId: roleUpper === 'TEACHER' || roleUpper === 'ADMIN' ? (profileData.id || profileData.teacher_id || '') : '',
            studentId: roleUpper === 'STUDENT' ? (profileData.id || profileData.student_id || '') : '',
            name: profileData.name || profileData.full_name || profileData.display_name || 'ผู้ใช้งานระบบ',
            email: profileData.email || '',
            role: roleUpper,
            avatar: profileData.avatar || profileData.avatar_url || profileData.photo_url || '',
            classroom: profileData.classroom || profileData.class_name || ''
        };

        // ล้างค่าเก่าที่อาจตีกันทิ้งก่อน
        localStorage.clear();
        sessionStorage.clear();

        // บันทึกลง Central Key หลัก
        localStorage.setItem('bcw_user_session', JSON.stringify(normalizedProfile));
        localStorage.setItem('user_logged_in', 'true');
        
        // บันทึกคีย์มาตรฐานสำรองเพื่อ backward compatibility
        localStorage.setItem('user_role', normalizedProfile.role);
        localStorage.setItem('user_name', normalizedProfile.name);
        if (normalizedProfile.avatar) localStorage.setItem('user_avatar', normalizedProfile.avatar);

        return normalizedProfile;
    },

    // 📖 2. อ่านข้อมูล Session ผู้ใช้ปัจจุบันจาก Central Storage
    getCurrentUser: function() {
        try {
            const sessionStr = localStorage.getItem('bcw_user_session');
            if (sessionStr) {
                const parsed = JSON.parse(sessionStr);
                if (parsed && parsed.role) return parsed;
            }
        } catch (e) {
            console.warn("AuthManager: Error reading central session", e);
        }

        // Fallback: ดึงจากคีย์เดี่ยวเฉพาะกรณีคีย์หลักไม่มี
        const name = localStorage.getItem('user_name');
        const role = localStorage.getItem('user_role');
        
        if (name && role) {
            return {
                id: localStorage.getItem('user_id') || '',
                userId: localStorage.getItem('user_id') || '',
                name: name,
                role: role.toUpperCase(),
                avatar: localStorage.getItem('user_avatar') || '',
                email: localStorage.getItem('user_email') || ''
            };
        }

        return null;
    },

    // 🔍 3. Resolver กลาง: ตรวจสอบหา Role ที่แท้จริงจาก Supabase Database
    resolveUserRole: async function(authUser) {
        if (!authUser) return null;

        const client = window.supabase || window.db;
        const email = (authUser.email || '').toLowerCase().trim();
        const userId = authUser.id || '';

        // 3.1 Hardcode Admin/Developer Fallback
        if (email === 'kruthanadol@buached.ac.th' || email.includes('admin')) {
            return this.setUserSession({
                id: userId,
                name: authUser.user_metadata?.full_name || 'ครูธนดล คำเสนอ (ADMIN)',
                role: 'ADMIN',
                email: email,
                avatar: authUser.user_metadata?.avatar_url || ''
            });
        }

        if (client) {
            // 3.2 ตรวจสอบในตาราง teachers ก่อน (สิทธิ์ครู/ผู้บริหาร)
            try {
                const { data: teacher } = await client
                    .from('teachers')
                    .select('*')
                    .or(`email.eq.${email},teacher_id.eq.${userId}`)
                    .maybeSingle();

                if (teacher) {
                    return this.setUserSession({
                        id: teacher.teacher_id || teacher.id || userId,
                        name: teacher.full_name || teacher.teacher_name || email.split('@')[0],
                        role: (teacher.role || 'TEACHER').toUpperCase(),
                        email: email,
                        avatar: teacher.avatar_url || authUser.user_metadata?.avatar_url || ''
                    });
                }
            } catch (err) {
                console.warn('AuthManager: Teacher lookup error', err);
            }

            // 3.3 ถ้าไม่เจอใน teachers ให้ตรวจสอบในตาราง students (สิทธิ์นักเรียน)
            try {
                const { data: student } = await client
                    .from('students')
                    .select('*')
                    .or(`email.eq.${email},id.eq.${userId}`)
                    .maybeSingle();

                if (student) {
                    const fullName = `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
                    return this.setUserSession({
                        id: student.student_id || student.id || userId,
                        name: fullName || email.split('@')[0],
                        role: 'STUDENT',
                        email: email,
                        avatar: student.avatar_url || authUser.user_metadata?.avatar_url || '',
                        classroom: student.classroom || ''
                    });
                }
            } catch (err) {
                console.warn('AuthManager: Student lookup error', err);
            }
        }

        // 3.4 Fallback กรณีไม่พบใน DB ทั้งคู่
        const defaultRole = email.includes('@buached.ac.th') ? 'TEACHER' : 'STUDENT';
        return this.setUserSession({
            id: userId,
            name: authUser.user_metadata?.full_name || email.split('@')[0] || 'ผู้ใช้งานระบบ',
            role: defaultRole,
            email: email,
            avatar: authUser.user_metadata?.avatar_url || ''
        });
    },

    // 🛡️ 4. Auth Guard เช็กสิทธิ์การเข้าถึงหน้าเว็บ
    requireAuth: function(allowedRoles = [], redirectUrl = '/login.html') {
        const user = this.getCurrentUser();

        if (!user || !user.role) {
            console.warn('🔒 Auth Guard: ไม่พบ Session การเข้าสู่ระบบ สั่ง Redirect ไปที่:', redirectUrl);
            window.location.replace(redirectUrl);
            return null;
        }

        const userRole = user.role.toUpperCase();
        const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());
        const isPowerUser = ['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN', 'EXECUTIVE'].includes(userRole);

        if (allowedRoles.length > 0 && !normalizedAllowed.includes(userRole) && !isPowerUser) {
            console.error(`🔒 Auth Guard Error: บทบาท "${userRole}" ไม่มีสิทธิ์เข้าถึงหน้านี้`);
            alert('🔒 คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            window.location.replace(redirectUrl);
            return null;
        }

        return user;
    },

    // 🚪 5. Logout ล้างข้อมูลระบบ
    logout: function(redirectUrl = '/login.html') {
        console.log('🚪 กำลังออกจากระบบ และล้าง Session ทั้งหมด...');
        localStorage.clear();
        sessionStorage.clear();
        
        const client = window.supabase || window.db;
        if (client && client.auth) {
            try { client.auth.signOut(); } catch (e) {}
        }
        
        window.location.replace(redirectUrl);
    }
};

// ---------------------------------------------------
// Backward Compatibility Functions for Window Object
// ---------------------------------------------------
function getCurrentUser() {
    return AuthManager.getCurrentUser();
}

function requireAuth(allowedRoles = [], redirectUrl = '/login.html') {
    return AuthManager.requireAuth(allowedRoles, redirectUrl);
}

function logout(redirectUrl = '/login.html') {
    AuthManager.logout(redirectUrl);
}

function isAuthenticated() {
    return AuthManager.getCurrentUser() !== null;
}

if (typeof window !== 'undefined') {
    window.AuthManager = AuthManager;
    window.getCurrentUser = getCurrentUser;
    window.requireAuth = requireAuth;
    window.logoutUser = logout;
    window.handleLogout = logout;
    window.isAuthenticated = isAuthenticated;
}
