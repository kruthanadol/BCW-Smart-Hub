// core/auth-service.js

const AuthService = {
    /**
     * สกัดข้อมูล Hybrid (ชื่อจริงภาษาไทยจาก DB + รูปสดจาก Google/LINE SSO)
     * และสั่ง Router ย้ายผู้ใช้งานไปหน้าหลักตามบทบาท
     */
    handlePostLogin: async function(ssoUser) {
        if (!ssoUser) return;

        const client = window.supabase || window.db;
        const email = (ssoUser.email || '').toLowerCase().trim();
        const userId = ssoUser.id || '';
        
        // 1. สกัดรูปถ่ายสดตรงจาก Google / LINE SSO (ตัดปัญหา HTTP 401 เรื่อง Storage)
        const ssoAvatar = ssoUser.user_metadata?.avatar_url || 
                          ssoUser.user_metadata?.picture || 
                          ssoUser.user_metadata?.photo_url || '';

        let detectedRole = 'STUDENT';
        let dbName = '';

        // 🔍 A. ตรวจสอบสิทธิ์ ADMIN / Developer
        if (email === 'kruthanadol@buached.ac.th' || email.includes('admin')) {
            detectedRole = 'ADMIN';
            dbName = ssoUser.user_metadata?.full_name || 'ผู้ดูแลระบบ (ADMIN)';
        }

        // 🔍 B. ค้นหาชื่อจริงภาษาไทยในตาราง teachers (สำหรับครู/ผู้บริหาร)
        if (!dbName && client) {
            try {
                const { data: teacher } = await client
                    .from('teachers')
                    .select('*')
                    .or(`email.eq.${email},teacher_id.eq.${userId}`)
                    .maybeSingle();

                if (teacher) {
                    detectedRole = (teacher.role || 'TEACHER').toUpperCase();
                    dbName = teacher.full_name || teacher.teacher_name || '';
                }
            } catch (e) { 
                console.warn('AuthService: Teacher query error:', e); 
            }
        }

        // 🔍 C. ค้นหาชื่อจริงภาษาไทยในตาราง students (สำหรับนักเรียน)
        if (!dbName && client) {
            try {
                const { data: student } = await client
                    .from('students')
                    .select('*')
                    .or(`email.eq.${email},id.eq.${userId}`)
                    .maybeSingle();

                if (student) {
                    detectedRole = 'STUDENT';
                    dbName = `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
                }
            } catch (e) { 
                console.warn('AuthService: Student query error:', e); 
            }
        }

        // 🔍 D. Fallback หากไม่พบชื่อใน DB ทั้งสองตาราง
        if (!dbName) {
            dbName = ssoUser.user_metadata?.full_name || ssoUser.user_metadata?.name || email.split('@')[0];
            if (email.includes('@buached.ac.th')) detectedRole = 'TEACHER';
        }

        // 💾 2. ประกอบร่าง Hybrid Profile บันทึกลง Session กลางคีย์เดียว
        const hybridProfile = {
            id: userId,
            name: dbName,            // ชื่อจริงภาษาไทยจาก DB
            avatar: ssoAvatar,       // รูปสดจาก Google/LINE SSO
            role: detectedRole,      // บทบาทจริงที่สกัดได้
            email: email
        };

        // ล้าง Storage เก่าทั้งหมด ป้องกันสิทธิ์ค้าง/ชนกัน
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('bcw_user_session', JSON.stringify(hybridProfile));

        // 🚀 3. สั่งแยกทางเดินผู้ใช้งานไปหน้าหลักประจำบทบาท
        this.redirectToRolePage(detectedRole);
    },

    /**
     * ฟังก์ชันจัดการ Router ดีดผู้ใช้ไปหน้าเป้าหมาย
     */
    redirectToRolePage: function(role) {
        const r = (role || 'STUDENT').toUpperCase();

        switch (r) {
            case 'ADMIN':
            case 'EXECUTIVE':
            case 'SUPERADMIN':
                window.location.replace('landing.html');
                break;

            case 'TEACHER':
                // ครูส่งไปหน้าเช็กชื่อทันทีตาม Workflow หลัก
                window.location.replace('apps/school-app/teacher.html');
                break;

            case 'STUDENT':
                window.location.replace('apps/school-app/student.html');
                break;

            case 'PARENT':
                window.location.replace('apps/school-app/parent.html');
                break;

            default:
                window.location.replace('landing.html');
                break;
        }
    }
};

if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
}
