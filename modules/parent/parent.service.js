import { db } from '../../core/supabase-client.js';

export const ParentService = {
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
     * ดึงตารางเรียนประจำวันจากตารางมาตรฐาน schedules เพียงอย่างเดียว
     */
    async getSchedule(classroom, dayName = 'Monday') {
        try {
            const { data, error } = await db
                .from('schedules')
                .select('*')
                .eq('classroom', classroom)
                .eq('day', dayName)
                .order('period', { ascending: true });

            if (error || !data) return [];
            return data;
        } catch (err) {
            console.warn('[ParentService] Error fetching schedule:', err);
            return [];
        }
    },

    async getDashboardData(studentId, dayName = 'Monday') {
        const student = await this.getStudentProfile(studentId);
        const classroom = student?.classroom || '-';

        const schedule = await this.getSchedule(classroom, dayName);

        return {
            student,
            schedule
        };
    }
};
