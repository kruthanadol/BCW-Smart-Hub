import { db } from '../../core/supabase-client.js';

/**
 * สั่งการบ้าน / มอบหมายงานประจำคาบ
 */
export async function createHomeworkAssignment({ subjectCode, classroom, title, dueDate }) {
    try {
        const { data, error } = await db.from('homework_assignments').insert([{
            subject_code: subjectCode,
            classroom: classroom,
            title: title,
            due_date: dueDate || null,
            created_at: new Date().toISOString()
        }]).select();

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Error in createHomeworkAssignment:', err);
        return { success: false, message: err.message };
    }
}