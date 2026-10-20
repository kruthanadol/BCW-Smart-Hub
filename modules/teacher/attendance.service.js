import { db, cleanStr } from '../../core/supabase-client.js';

/**
 * 1. ดึงสรุปสถานะไฟจราจรประตูโรงเรียนยามเช้า
 */
export async function getTrafficSummary() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await db.from('attendance_logs').select('traffic_status, status').gte('check_date', today);

        if (error) throw error;

        let green = 0, blue = 0, red = 0, purple = 0;
        if (data) {
            data.forEach(l => {
                const st = l.traffic_status || (l.status === 'present' ? 'GREEN' : (l.status === 'absent' ? 'RED' : 'GREEN'));
                if (st === 'GREEN') green++;
                else if (st === 'BLUE') blue++;
                else if (st === 'RED') red++;
                else if (st === 'PURPLE') purple++;
            });
        }
        return { green, blue, red, purple };
    } catch (err) {
        console.error('Error in getTrafficSummary:', err);
        return { green: 0, blue: 0, red: 0, purple: 0 };
    }
}

/**
 * 2. บันทึกสถิติการเข้าเรียน (พร้อมหักคะแนนพฤติกรรมกรณีหนีเรียน)
 */
export async function submitClassAttendance({ students, subjectCode }) {
    try {
        const today = new Date().toISOString().split('T')[0];

        for (const s of students) {
            let trafficStatus = 'GREEN';
            if (s.status === 'absent' || s.status === 'truant') trafficStatus = 'RED';
            else if (s.status === 'leave') trafficStatus = 'BLUE';

            await db.from('attendance_logs').insert([{
                student_id: cleanStr(s.student_id),
                student_name: s.student_name,
                status: s.status,
                traffic_status: trafficStatus,
                check_date: today,
                created_at: new Date().toISOString()
            }]);

            if (s.status === 'truant') {
                await db.from('behavior_logs').insert([{
                    student_id: cleanStr(s.student_id),
                    student_name: s.student_name,
                    type: 'deduct',
                    action: 'หนีเรียน/ออกนอกสถานศึกษา',
                    points: -10,
                    note: `ระบบตัดคะแนนอัตโนมัติ: หนีเรียนวิชา ${subjectCode} (${s.note || ''})`,
                    created_at: new Date().toISOString()
                }]);
            }
        }
        return { success: true };
    } catch (err) {
        console.error('Error in submitClassAttendance:', err);
        return { success: false, message: err.message };
    }
}