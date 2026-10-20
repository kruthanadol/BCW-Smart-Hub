import { db } from '../../core/supabase-client.js';

/**
 * 1. ดึงรายชื่อครูทั้งหมดจากฐานข้อมูล Supabase
 */
export async function getTeachersList() {
    try {
        let { data, error } = await db.from('users').select('full_name').eq('role', 'teacher');
        if (!data || data.length === 0) {
            const fallback = await db.from('teachers').select('full_name, name');
            data = fallback.data || [];
        }

        if (data && data.length > 0) {
            return data.map(t => t.full_name || t.name).filter(Boolean);
        }

        return [
            "นายสมชาย ใจดี",
            "นางสาวศิริพร วิทยา",
            "นายอนันต์ ภาษาไทย"
        ];
    } catch (err) {
        console.error('Error fetching teachers list:', err);
        return ["นายสมชาย ใจดี"];
    }
}

/**
 * 2. ประมวลผลดึงข้อมูลนักเรียน สถิติการเข้าเรียน พฤติกรรม และประวัติห้องพยาบาล Real-time
 */
export async function generateMasterReportData({ selectedClass }) {
    try {
        // 1. ดึงข้อมูลนักเรียนหลัก
        let stdQuery = db.from('students').select('id, student_id, first_name, last_name, classroom, behavior_score, advisor_name');
        if (selectedClass && selectedClass !== 'ALL') {
            stdQuery = stdQuery.eq('classroom', selectedClass);
        }
        const { data: students, error: stdErr } = await stdQuery;
        if (stdErr) throw stdErr;

        if (!students || students.length === 0) {
            return [];
        }

        // 2. ดึงข้อมูลตารางประกอบอื่นๆ
        const { data: attLogs } = await db.from('attendance_logs').select('*');
        const { data: behaviorLogs } = await db.from('behavior_logs').select('*');
        const { data: clinicLogs } = await db.from('clinic_records').select('*');
        const { data: parentNotifs } = await db.from('parent_notifications').select('*');

        const TOTAL_PERIODS = 20;

        // 3. รวบรวมและจัดกลุ่มข้อมูลย่อยสำหรับประมวลผลรายงาน
        return students.map(std => {
            const fullName = `${std.first_name || ''} ${std.last_name || ''}`.trim();
            const sId = std.student_id || std.id;

            // กรอง Logs สแกน/เข้าเรียน
            const myAtt = (attLogs || []).filter(l => l.student_id === sId || l.student_id === std.id);
            const attended = myAtt.filter(l => l.status === 'present' || l.status === 'มา').length;
            const late = myAtt.filter(l => l.status === 'late' || l.status === 'สาย').length;
            const truant = myAtt.filter(l => l.status === 'truant' || l.status === 'หนีเรียน' || l.status === 'ขาด').length;
            const totalAtt = attended + late;
            const attPercent = Math.round((totalAtt / TOTAL_PERIODS) * 100);

            // กรอง Logs พฤติกรรม
            const myBehave = (behaviorLogs || []).filter(b => b.student_id === sId || b.student_id === std.id);
            const currentBehaveScore = std.behavior_score !== undefined ? std.behavior_score : 100;

            // กรอง Logs ห้องพยาบาล & แจ้งผู้ปกครอง
            const myClinic = (clinicLogs || []).filter(c => c.student_id === sId || c.student_id === std.id).length;
            const myNotif = (parentNotifs || []).filter(n => n.student_id === sId || n.student_id === std.id).length;

            return {
                student_id: sId,
                student_name: fullName,
                class: std.classroom || selectedClass,
                attended_periods: totalAtt,
                total_periods: TOTAL_PERIODS,
                attendance_percent: attPercent,
                truant_count: truant,
                behavior_score: currentBehaveScore,
                behavior_logs: myBehave,
                clinic_count: myClinic,
                notif_count: myNotif
            };
        });
    } catch (err) {
        console.error("Error in generateMasterReportData:", err);
        throw err;
    }
}