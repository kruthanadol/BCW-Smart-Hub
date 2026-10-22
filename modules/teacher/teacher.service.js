import { db } from '../../core/supabase-client.js';

export const TeacherService = {
    // 1. ดึงโปรไฟล์ครูผู้สอน
    async getProfile(teacherId) {
        try {
            if (!teacherId) return null;

            // ค้นหาจากตาราง users โดยเช็กทั้ง id หรือ teacher_id
            const { data, error } = await db
                .from('users')
                .select('*')
                .or(`id.eq.${teacherId},teacher_id.eq.${teacherId}`)
                .maybeSingle();

            if (error || !data) return null;

            return {
                ...data,
                full_name: data.full_name || data.name || 'ครูผู้สอน',
                avatar: data.avatar || data.photo_url || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'
            };
        } catch (err) {
            console.warn('[TeacherService] Error fetching profile:', err);
            return null;
        }
    },

    // 2. ดึงรายการวิชาที่ได้รับมอบหมาย
    async getAssignedCourses(teacherId) {
        try {
            let query = db.from('course_assignments').select('*');
            
            if (teacherId) {
                query = query.or(`teacher_id.eq.${teacherId},assigned_to.eq.${teacherId}`);
            }

            const { data, error } = await query;

            if (error || !data || data.length === 0) {
                // ข้อมูลสำรองเผื่อตารางใน DB ยังไม่มีข้อมูล
                return [
                    { course_code: 'ค32101', classroom: 'ม.5/1', subject_name: 'คณิตศาสตร์พื้นฐาน (ค32101)' },
                    { course_code: 'ค32201', classroom: 'ม.5/1', subject_name: 'คณิตศาสตร์เพิ่มเติม (ค32201)' }
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
