import { db } from '../../core/supabase-client.js';

export const TeacherService = {
    // 1. ดึงโปรไฟล์ครู
    async getProfile(teacherId) {
        try {
            if (!teacherId) return { teacher_id: teacherId, full_name: 'ครูผู้สอน' };
            const { data, error } = await db
                .from('users')
                .select('*')
                .eq('id', String(teacherId))
                .maybeSingle();

            if (error || !data) {
                return { teacher_id: teacherId, full_name: 'นางสาวขัตติยา สุขรอบ' };
            }
            return {
                ...data,
                full_name: data.full_name || data.name || 'นางสาวขัตติยา สุขรอบ',
                avatar: data.avatar || data.photo_url || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'
            };
        } catch (err) {
            console.warn('[TeacherService] Error fetching profile:', err);
            return { teacher_id: teacherId, full_name: 'นางสาวขัตติยา สุขรอบ' };
        }
    },

    // 2. ดึงรายการวิชาที่มอบหมาย
    async getAssignedCourses(teacherId) {
        try {
            const { data, error } = await db
                .from('course_assignments')
                .select('*');

            if (error || !data || data.length === 0) {
                return [
                    { course_code: 'วิชาทั่วไป', class_name: 'ม.1/1', subject_name: 'วิชาทั่วไป' },
                    { course_code: 'ค32201', class_name: 'ม.5/1', subject_name: 'คณิตศาสตร์เพิ่มเติม (ค32201)' },
                    { course_code: 'ค32101', class_name: 'ม.5/1', subject_name: 'คณิตศาสตร์พื้นฐาน (ค32101)' },
                    { course_code: 'ค32101', class_name: 'ม.5/2', subject_name: 'คณิตศาสตร์พื้นฐาน (ค32101)' }
                ];
            }
            return data;
        } catch (err) {
            console.warn('[TeacherService] Error fetching courses:', err);
            return [];
        }
    },

    // 3. ดึงรายชื่อนักเรียนตามห้อง
    async getStudentsByClass(className) {
        try {
            if (!className) return [];
            const { data, error } = await db
                .from('students')
                .select('*')
                .eq('classroom', className)
                .order('student_no', { ascending: true });

            if (error || !data) return [];
            return data.map(s => ({
                ...s,
                fullName: `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`.trim() || s.full_name || 'นักเรียน',
                studentNo: s.student_no ?? s.no ?? '-'
            }));
        } catch (err) {
            console.warn('[TeacherService] Error fetching students:', err);
            return [];
        }
    },

    // 4. บันทึกการเช็กชื่อ
    async submitAttendance(attendanceRecords) {
        try {
            const { data, error } = await db
                .from('attendance_logs')
                .upsert(attendanceRecords);

            if (error) throw error;
            return { success: true, data };
        } catch (err) {
            console.error('[TeacherService] Error submitting attendance:', err);
            return { success: false, message: err.message };
        }
    },

    // 5. สั่งการบ้าน
    async createHomework(homeworkData) {
        try {
            const { data, error } = await db
                .from('homework_assignments')
                .insert([homeworkData]);

            if (error) throw error;
            return { success: true, data };
        } catch (err) {
            console.error('[TeacherService] Error creating homework:', err);
            return { success: false, message: err.message };
        }
    }
};
