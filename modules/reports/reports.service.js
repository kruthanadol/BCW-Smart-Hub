import { db } from '../../core/supabase-client.js';

export async function getTeachersList() {
    try {
        let { data, error } = await db.from('users').select('full_name').eq('role', 'teacher');
        if (error) console.warn('Users table query warning:', error.message);

        if (!data || data.length === 0) {
            const fallback = await db.from('teachers').select('full_name, name');
            data = fallback.data || [];
        }

        if (data && data.length > 0) {
            return data.map(t => t.full_name || t.name).filter(Boolean);
        }

        return ["นายสมชาย ใจดี", "นางสาวศิริพร วิทยา", "นายอนันต์ ภาษาไทย"];
    } catch (err) {
        console.error('Error fetching teachers list:', err);
        return ["นายสมชาย ใจดี"];
    }
}

export async function generateMasterReportData({ selectedClass }) {
    try {
        // 1. ดึงข้อมูลนักเรียนตามห้องเรียน
        let stdQuery = db.from('students').select('id, student_id, first_name, last_name, classroom, behavior_score, advisor_name');
        if (selectedClass && selectedClass !== 'ALL') {
            stdQuery = stdQuery.eq('classroom', selectedClass);
        }
        const { data: students, error: stdErr } = await stdQuery;
        if (stdErr) throw stdErr;
        if (!students || students.length === 0) return [];

        // รวบรวม ID ทั้งหมดเพื่อใช้กรองใน Database (ไม่ดึงทั้งโรงเรียน)
        const studentIds = students.flatMap(s => [s.student_id, s.id]).filter(Boolean);

        // 2. ดึงข้อมูลเฉพาะนักเรียนกลุ่มนี้พร้อมกัน (Parallel Query)
        const [attRes, behaveRes, clinicRes, notifRes] = await Promise.all([
            db.from('attendance_logs').select('*').in('student_id', studentIds),
            db.from('behavior_logs').select('*').in('student_id', studentIds),
            db.from('clinic_records').select('*').in('student_id', studentIds),
            db.from('parent_notifications').select('*').in('student_id', studentIds)
        ]);

        const attLogs = attRes.data || [];
        const behaviorLogs = behaveRes.data || [];
        const clinicLogs = clinicRes.data || [];
        const parentNotifs = notifRes.data || [];

        // 3. ประมวลผลรายบุคคล
        return students.map(std => {
            const fullName = `${std.first_name || ''} ${std.last_name || ''}`.trim();
            const sId = std.student_id || std.id;

            const myAtt = attLogs.filter(l => l.student_id === std.student_id || l.student_id === std.id);
            const attended = myAtt.filter(l => l.status === 'present' || l.status === 'มา').length;
            const late = myAtt.filter(l => l.status === 'late' || l.status === 'สาย').length;
            const truant = myAtt.filter(l => l.status === 'truant' || l.status === 'หนีเรียน' || l.status === 'ขาด').length;
            
            // คำนวณจากจำนวนคาบที่เช็กชื่อจริง (ถ้ายังไม่เคยเช็กชื่อให้เป็น 100% ไว้ก่อน)
            const totalRecorded = myAtt.length;
            const totalAtt = attended + late;
            const attPercent = totalRecorded > 0 ? Math.round((totalAtt / totalRecorded) * 100) : 100;

            const myBehave = behaviorLogs.filter(b => b.student_id === std.student_id || b.student_id === std.id);
            const currentBehaveScore = std.behavior_score ?? 100;

            const myClinic = clinicLogs.filter(c => c.student_id === std.student_id || c.student_id === std.id).length;
            const myNotif = parentNotifs.filter(n => n.student_id === std.student_id || n.student_id === std.id).length;

            return {
                student_id: sId,
                student_name: fullName,
                class: std.classroom || selectedClass,
                attended_periods: totalAtt,
                total_periods: totalRecorded,
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
