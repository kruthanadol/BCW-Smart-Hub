import { db } from '../../core/supabase-client.js';

/**
 * ดึงข้อมูลรวมสำหรับ Dashboard ฝ่ายปกครอง
 */
export async function fetchDisciplineDashboardData() {
    try {
        const [studentsRes, behaviorRes, gateRes, attRes, clinicRes] = await Promise.all([
            db.from('students').select('*'),
            db.from('behavior_logs').select('*').order('created_at', { ascending: false }),
            db.from('gatepass_logs').select('*').order('created_at', { ascending: false }),
            db.from('attendance_logs').select('*').eq('status', 'TRUANT'),
            db.from('clinic_logs').select('*')
        ]);

        return {
            students: studentsRes.data || [],
            behaviorLogs: behaviorRes.data || [],
            gatePassLogs: gateRes.data || [],
            attendanceLogs: attRes.data || [],
            clinicRecords: clinicRes.data || []
        };
    } catch (err) {
        console.error('Error fetching discipline data:', err);
        return { students: [], behaviorLogs: [], gatePassLogs: [], attendanceLogs: [], clinicRecords: [] };
    }
}

/**
 * รวมชื่อ-นามสกุลนักเรียน
 */
export function getStudentFullName(student) {
    if (!student) return 'ไม่ระบุชื่อ';
    if (student.first_name && student.last_name) {
        return `${student.prefix || ''}${student.first_name} ${student.last_name}`.trim();
    }
    return student.name || student.student_name || 'นักเรียน';
}

/**
 * คำนวณคะแนนพฤติกรรมคงเหลือ (เริ่มต้น 100 คะแนน)
 */
export function calculateStudentScore(studentName, behaviorLogs = []) {
    const logs = behaviorLogs.filter(b => (b.student_name || '').includes(studentName));
    let score = 100;
    logs.forEach(l => {
        score += (Number(l.points) || 0);
    });
    return Math.max(0, score);
}

/**
 * บันทึกประวัติคะแนนความประพฤติ
 */
export async function saveBehaviorRecord({ studentId, studentName, type, action, points, note }) {
    try {
        const { data, error } = await db.from('behavior_logs').insert([{
            student_id: studentId,
            student_name: studentName,
            type: type,
            action: action,
            points: points,
            note: note,
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Error saving behavior record:', err);
        return { success: false, message: err.message };
    }
}

/**
 * บันทึกขออนุญาตออกนอกสถานศึกษา (Gatepass)
 */
export async function saveGatePassRecord({ studentId, studentName, reason, exitTime, returnTime, approvedBy }) {
    try {
        const { data, error } = await db.from('gatepass_logs').insert([{
            student_id: studentId,
            student_name: studentName,
            reason: reason,
            exit_time: exitTime,
            return_time: returnTime,
            approved_by: approvedBy,
            status: 'approved',
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Error saving gatepass record:', err);
        return { success: false, message: err.message };
    }
}