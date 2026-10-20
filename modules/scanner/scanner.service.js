import { db } from '../../core/supabase-client.js';

/**
 * บันทึกการเข้าประตูโรงเรียน (Gate In)
 */
export async function recordGateIn({ studentId }) {
    try {
        const { data: student, error: fetchErr } = await db
            .from('students')
            .select('student_id, first_name, last_name, prefix, classroom')
            .eq('student_id', studentId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!student) {
            return { success: false, message: `ไม่พบรหัสนักเรียน: ${studentId}` };
        }

        const fullName = `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim();
        const now = new Date();
        const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        const { error: insertErr } = await db.from('attendance_logs').insert([{
            student_id: studentId,
            classroom: student.classroom || 'ไม่ระบุ',
            status: 'PRESENT',
            recorded_by: 'BCW Smart Gate Scanner',
            created_at: now.toISOString()
        }]);

        if (insertErr) throw insertErr;

        return {
            success: true,
            studentName: fullName,
            classroom: student.classroom,
            timeStr
        };

    } catch (err) {
        console.error('Error recording gate in:', err);
        return { success: false, message: err.message };
    }
}

/**
 * ฟังก์ชันสำหรับประมวลผล Smart Classroom AI Scan ในอนาคต
 */
export async function processClassroomScan({ classroom, scannedStudentIds, recordedBy }) {
    try {
        if (!scannedStudentIds || scannedStudentIds.length === 0) {
            return { success: false, message: 'ไม่พบรายการนักเรียนที่สแกน' };
        }

        const now = new Date().toISOString();
        const payload = scannedStudentIds.map(id => ({
            student_id: id,
            classroom: classroom,
            status: 'PRESENT',
            recorded_by: recordedBy || 'AI Classroom Scanner',
            created_at: now
        }));

        const { error } = await db.from('attendance_logs').insert(payload);
        if (error) throw error;

        return { success: true, count: payload.length };
    } catch (err) {
        console.error('Error processing classroom scan:', err);
        return { success: false, message: err.message };
    }
}