// modules/academic/course-management.service.js
import { db, cleanStr } from '../../core/supabase-client.js';

// ดึงรายการรายวิชาทั้งหมดตามปีการศึกษา/เทอม
export async function fetchCourses(academicYear = '2569', semester = '1') {
    try {
        const { data, error } = await db
            .from('courses')
            .select('*')
            .eq('academic_year', academicYear)
            .eq('semester', semester)
            .order('course_code', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error fetching courses:', e);
        return [];
    }
}

// ดึงตารางเรียนรายวิชาของห้องเรียน
export async function fetchClassSchedule(classroom) {
    try {
        const { data, error } = await db
            .from('schedules')
            .select('*, courses(*)')
            .eq('classroom', cleanStr(classroom))
            .order('day_of_week', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error fetching class schedule:', e);
        return [];
    }
}