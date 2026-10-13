// ==========================================
// BCW Central Data Store - Live Supabase Connection
// ==========================================

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; // <--- เปลี่ยนเป็น URL ของคุณ
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';             // <--- เปลี่ยนเป็น Anon Key ของคุณ

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const BCW_STORE = {
    // 1. เช็คสิทธิ์การเข้าใช้งาน
    checkAuth: async function(allowedRoles = []) {
        if (!supabase) return false;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = "login.html";
            return false;
        }
        return true;
    },

    // 2. ดึงข้อมูลนักเรียนจากตาราง `students`
    getStudentProfile: async function(studentId) {
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('student_id', studentId)
            .single();

        if (error) {
            console.error('Error fetching student:', error);
            return null;
        }
        
        // หากไม่มี avatar_url ให้สร้าง URL จาก Supabase Storage โดยอัตโนมัติ
        if (!data.avatar_url) {
            data.avatar_url = `${SUPABASE_URL}/storage/v1/object/public/avatars/${data.student_id}.jpg`;
        }
        return data;
    },

    // 3. ดึงเวลาเรียนและสิทธิ์สอบ มส. จาก View `v_academic_attendance_risk` และตาราง `subject_attendance`
    getStudentSubjects: async function(studentId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('subject_attendance')
            .select(`
                *,
                courses (course_code, course_name, teacher_name)
            `)
            .eq('student_id', studentId);

        if (error) {
            console.error('Error fetching attendance:', error);
            return [];
        }

        return data.map(item => ({
            subjectCode: item.courses?.course_code || 'N/A',
            subjectName: item.courses?.course_name || 'ไม่ระบุวิชา',
            teacherName: item.courses?.teacher_name || 'ครูผู้สอน',
            attendedPeriods: item.attended_periods || 0,
            totalPeriods: item.total_periods || 0,
            absentPeriods: (item.total_periods || 0) - (item.attended_periods || 0),
            maxAllowedAbsence: item.max_allowed_absence || 4
        }));
    },

    // 4. ดึงประวัติความประพฤติจากตาราง `behavior_logs` และ `student_discipline_logs`
    getBehaviorLogs: async function(studentId) {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('behavior_logs')
            .select('*')
            .eq('student_id', studentId)
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching behavior logs:', error);
            return [];
        }

        return data.map(log => ({
            id: log.id,
            reason: log.reason || log.description,
            scoreChange: log.score_change || log.points || 0,
            teacherName: log.recorded_by || 'ฝ่ายปกครอง',
            timestamp: new Date(log.created_at || log.timestamp).toLocaleString('th-TH')
        }));
    },

    // 5. ดึงรายงานความเสี่ยงรวมสำหรับผู้บริหาร จาก View `v_export_academic_risk_report`
    getExecutiveAcademicRisks: async function() {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('v_export_academic_risk_report')
            .select('*');

        if (error) {
            console.error('Error fetching academic risk report:', error);
            return [];
        }
        return data;
    },

    // 6. ออกจากระบบ
    logout: async function() {
        if (supabase) await supabase.auth.signOut();
        window.location.href = "login.html";
    }
};