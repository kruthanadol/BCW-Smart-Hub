import { db } from '../../core/supabase-client.js';

/**
 * ดึงโปรไฟล์นักเรียน
 */
export async function getStudentProfile(studentId) {
    try {
        const { data, error } = await db
            .from('students')
            .select('*')
            .eq('student_id', studentId)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Error fetching student profile:', err);
        return null;
    }
}

/**
 * ยื่นคำขอขอออกนอกสถานศึกษา (Gatepass)
 */
export async function submitGatepassRequest({ studentId, studentName, reason, exitTime, returnTime }) {
    try {
        const { data, error } = await db.from('gatepass_logs').insert([{
            student_id: studentId,
            student_name: studentName,
            reason: reason,
            exit_time: exitTime,
            return_time: returnTime,
            status: 'pending',
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Error submitting gatepass:', err);
        return { success: false, message: err.message };
    }
}

/**
 * ดึงบัตรผ่านดิจิทัล (Gatepass) ที่กำลังใช้งานอยู่
 */
export async function getActiveGatepass(studentId) {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data, error } = await db
            .from('gatepass_logs')
            .select('*')
            .eq('student_id', studentId)
            .gte('created_at', `${todayStr}T00:00:00`)
            .order('created_at', { ascending: false })
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    } catch (err) {
        console.error('Error fetching active gatepass:', err);
        return null;
    }
}

/**
 * ดึงตารางเรียนพร้อมข้อมูลครูผู้สอน
 */
export async function getStudentScheduleWithTeachers(className, dayOfWeek) {
    try {
        const { data, error } = await db
            .from('schedules')
            .select('*, courses(course_name)')
            .eq('class_name', className)
            .eq('day_of_week', dayOfWeek)
            .order('period_no', { ascending: true });

        if (error) throw error;

        return (data || []).map(s => ({
            period_no: s.period_no,
            course_code: s.course_code,
            course_name: s.courses ? s.courses.course_name : s.course_code,
            room_no: s.room_no || 'ไม่ระบุ',
            teacher_name: 'ครูผู้สอน',
            avatar_url: 'https://cdn-icons-png.flaticon.com/512/847/847969.png'
        }));
    } catch (err) {
        console.error('Error fetching student schedule:', err);
        return [];
    }
}

/**
 * ดึงข้อมูลครูที่ปรึกษาประจำห้อง
 */
export async function getClassAdvisors(className) {
    try {
        const { data, error } = await db
            .from('class_advisors')
            .select('*, users(full_name, email)')
            .eq('class_name', className);

        if (error) throw error;

        return (data || []).map(a => ({
            teacher_name: a.users ? a.users.full_name : a.teacher_id,
            email: a.users ? a.users.email : '',
            advisor_type: a.advisor_type,
            avatar_url: 'https://cdn-icons-png.flaticon.com/512/847/847969.png'
        }));
    } catch (err) {
        console.error('Error fetching class advisors:', err);
        return [];
    }
}

/**
 * ดึงข้อมูลเวลาเรียนสะสม/กลุ่มเสี่ยง มส.
 */
export async function getStudentAcademicRisks(studentId) {
    try {
        const { data, error } = await db
            .from('v_academic_attendance_risk')
            .select('*')
            .eq('student_id', studentId);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching academic risks:', err);
        return [];
    }
}

/**
 * ดึงประวัติคะแนนพฤติกรรม
 */
export async function getStudentBehaviorLogs(studentId) {
    try {
        const { data, error } = await db
            .from('behavior_logs')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching behavior logs:', err);
        return [];
    }
}

/**
 * ดึงรายการการบ้าน
 */
export async function getStudentHomeworks(className) {
    try {
        const { data, error } = await db
            .from('homework_assignments')
            .select('*')
            .eq('class_name', className)
            .order('due_date', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching student homeworks:', err);
        return [];
    }
}

/**
 * ดึงประวัติห้องพยาบาล
 */
export async function getStudentClinicRecords(studentId) {
    try {
        const { data, error } = await db
            .from('clinic_logs')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching clinic records:', err);
        return [];
    }
}