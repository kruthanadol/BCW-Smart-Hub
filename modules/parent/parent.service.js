import { db } from '../../core/supabase-client.js';

/**
 * ParentService - บริการจัดการข้อมูลสำหรับแดชบอร์ดผู้ปกครอง
 */
export const ParentService = {
    /**
     * ดึงข้อมูลโปรไฟล์นักเรียน
     */
    async getStudentProfile(studentId) {
        try {
            const { data, error } = await db
                .from('students')
                .select('*')
                .eq('student_id', String(studentId))
                .maybeSingle();

            if (error || !data) return null;

            const fullName = `${data.prefix || ''}${data.first_name || ''} ${data.last_name || ''}`.trim() || data.full_name || 'นักเรียน';
            const classroom = data.classroom || data.class || '-';
            const studentNo = data.student_no ?? data.no ?? '-';

            return {
                ...data,
                fullName,
                classroom,
                studentNo,
                behaviorScore: data.behavior_score ?? 100,
                avatarUrl: data.avatar_url || data.photo_url || null
            };
        } catch (err) {
            console.warn('[ParentService] Error fetching student profile:', err);
            return null;
        }
    },

    /**
     * ดึงตารางเรียนประจำวันตามชั้นเรียนและวัน
     */
    async getSchedule(classroom, dayName = 'Monday') {
        try {
            const { data, error } = await db.from('schedules').select('*');
            if (error || !data) return [];

            // กรองข้อมูลฝั่ง Client-side เพื่อป้องกัน Query Syntax Mismatch
            return data.filter(s => {
                const matchDay = (s.day || '').toLowerCase() === dayName.toLowerCase();
                const matchClass = (s.classroom || s.class || '') === classroom;
                return matchDay && matchClass;
            }).sort((a, b) => (a.period || 0) - (b.period || 0));
        } catch (err) {
            console.warn('[ParentService] Error fetching schedule:', err);
            return [];
        }
    },

    /**
     * ดึงประวัติการยื่นใบลา (จาก gate_pass_logs)
     */
    async getLeaveHistory(studentId) {
        try {
            const { data, error } = await db.from('gate_pass_logs').select('*');
            if (error || !data) return [];

            return data.filter(r => String(r.student_id) === String(studentId));
        } catch (err) {
            console.warn('[ParentService] Error fetching leave history:', err);
            return [];
        }
    },

    /**
     * ดึงสรุปสถิติการมาเรียน (จาก attendance_logs)
     */
    async getAttendanceStats(studentId) {
        const stats = { present: 0, late: 0, absent: 0, truant: 0 };
        try {
            const { data, error } = await db.from('attendance_logs').select('*');
            if (error || !data) return stats;

            const logs = data.filter(l => String(l.student_id) === String(studentId));
            logs.forEach(l => {
                const st = (l.status || '').toLowerCase().trim();
                if (st === 'present' || st === 'green' || st === 'มา') stats.present++;
                else if (st === 'late' || st === 'สาย') stats.late++;
                else if (st === 'absent' || st === 'red' || st === 'ขาด') stats.absent++;
                else if (st === 'truant' || st === 'purple' || st === 'หนี') stats.truant++;
            });

            return stats;
        } catch (err) {
            console.warn('[ParentService] Error fetching attendance stats:', err);
            return stats;
        }
    },

    /**
     * ดึงข้อมูลทั้งหมดสำหรับแดชบอร์ดในคำสั่งเดียว
     */
    async getDashboardData(studentId, dayName = 'Monday') {
        const student = await this.getStudentProfile(studentId);
        const classroom = student?.classroom || '-';

        const [schedule, leaveHistory, attendanceStats] = await Promise.all([
            this.getSchedule(classroom, dayName),
            this.getLeaveHistory(studentId),
            this.getAttendanceStats(studentId)
        ]);

        return {
            student,
            schedule,
            leaveHistory,
            attendanceStats
        };
    }
};
