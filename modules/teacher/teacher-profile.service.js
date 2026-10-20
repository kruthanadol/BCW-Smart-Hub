import { db, cleanStr } from '../../core/supabase-client.js';

/**
 * 1. ดึงข้อมูลครูผู้สอน
 */
export async function getTeacherProfile() {
    try {
        const storedUser = JSON.parse(localStorage.getItem('user_profile') || sessionStorage.getItem('user_profile') || '{}');
        if (storedUser && storedUser.full_name) return storedUser;

        const { data } = await db.from('users').select('*').eq('role', 'TEACHER').limit(1).maybeSingle();
        return data || { id: '11111111-1111-1111-1111-111111111111', full_name: 'ครูสมศรี วิชาการ' };
    } catch (err) {
        return { id: '11111111-1111-1111-1111-111111111111', full_name: 'ครูสมศรี วิชาการ' };
    }
}

/**
 * 2. ดึงรายการห้องเรียนทั้งหมด
 */
export async function getClassroomList() {
    try {
        const { data, error } = await db.from('students').select('classroom').not('classroom', 'is', null);
        if (error || !data) return [];
        return [...new Set(data.map(c => c.classroom))];
    } catch (err) {
        return [];
    }
}

/**
 * 3. ดึงนักเรียนประจำห้อง
 */
export async function getStudentsByClassroom(classroom) {
    try {
        const { data, error } = await db.from('students').select('*').eq('classroom', classroom).order('number_no', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error in getStudentsByClassroom:', err);
        return [];
    }
}

/**
 * 4. ดึงการแจ้งเตือนพิเศษประจำตัวนักเรียน (ใบลา/ห้องพยาบาล)
 */
export async function getStudentAlerts(studentId) {
    const today = new Date().toISOString().split('T')[0];
    let badges = [];
    let autoNote = '';
    let parentPhone = '';

    try {
        const { data: leaveReq } = await db.from('leave_requests')
            .select('leave_type, reason, status, parent_phone, parent_pin')
            .eq('student_id', cleanStr(studentId))
            .lte('start_date', today)
            .gte('end_date', today)
            .maybeSingle();

        if (leaveReq) {
            const leaveType = leaveReq.leave_type === 'sick' ? 'ลาป่วย' : 'ลากิจ';
            badges.push(`<span class="bg-blue-100 text-blue-800 border border-blue-300 text-[10px] px-2 py-0.5 rounded-md font-semibold">✉️ ${leaveType} (PIN: ${leaveReq.parent_pin || 'ยืนยัน'})</span>`);
            autoNote = `ขอ${leaveType} (${leaveReq.reason || '-'}) [โทร: ${leaveReq.parent_phone || '-'}]`;
            if (leaveReq.parent_phone) parentPhone = leaveReq.parent_phone;
        }

        const { data: clinic } = await db.from('clinic_records')
            .select('symptom, status')
            .eq('student_id', cleanStr(studentId))
            .gte('check_in', today)
            .maybeSingle();

        if (clinic && clinic.status !== 'completed') {
            const symptomText = clinic.symptom || 'ป่วย';
            badges.push(`<span class="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-2 py-0.5 rounded-md font-semibold">🏥 นอนห้องพยาบาล (${symptomText})</span>`);
            autoNote = autoNote ? `${autoNote} / นอนห้องพยาบาล (${symptomText})` : `นอนห้องพยาบาล (${symptomText})`;
        }
    } catch (err) {
        console.error('Error in getStudentAlerts:', err);
    }

    return { badges: badges.join(' '), noteText: autoNote, phone: parentPhone };
}