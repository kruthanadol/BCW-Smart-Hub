// modules/academic/exam-schedule.service.js
import { db, cleanStr } from '../../core/supabase-client.js';

// ดึงผังตารางสอบและห้องสอบของนักเรียน
export async function fetchExamSchedule(classroom) {
    try {
        const { data, error } = await db
            .from('exam_schedules')
            .select('*')
            .eq('classroom', cleanStr(classroom))
            .order('exam_date', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error fetching exam schedule:', e);
        return [];
    }
}