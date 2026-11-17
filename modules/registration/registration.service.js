/**
 * BCW Smart Hub - Registration Service (วิชาเลือกเสรี & กิจกรรมชุมนุม)
 * เชื่อมต่อ Supabase Database และ RPC Functions
 */
const db = window.supabaseClient || window.db || window.supabase;

export const DEFAULT_ACADEMIC_YEAR = '2569';
export const DEFAULT_SEMESTER = '1';

/**
 * 1. ดึงข้อมูลช่วงเวลาเปิด-ปิดลงทะเบียน ตามประเภท ('ELECTIVE' หรือ 'CLUB')
 */
export async function getRegistrationPeriod(category = 'ELECTIVE', academicYear = DEFAULT_ACADEMIC_YEAR, semester = DEFAULT_SEMESTER) {
    const { data, error } = await db
        .from('registration_periods')
        .select('*')
        .eq('category', category)
        .eq('academic_year', academicYear)
        .eq('semester', semester)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * 2. อัปเดตหรือตั้งค่าช่วงเวลาเปิด-ปิด (สำหรับฝ่ายวิชาการ/Admin)
 */
export async function saveRegistrationPeriod(payload) {
    const { data, error } = await db
        .from('registration_periods')
        .upsert({
            category: payload.category,
            academic_year: payload.academic_year || DEFAULT_ACADEMIC_YEAR,
            semester: payload.semester || DEFAULT_SEMESTER,
            start_at: payload.start_at,
            end_at: payload.end_at,
            is_active: payload.is_active,
            updated_at: new Date().toISOString()
        }, { onConflict: 'category,academic_year,semester' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * 3. ดึงรายการวิชาเลือกเสรี / ชุมนุม ที่เปิดสอน
 * @param {Object} filters - { category, status, teacherId, academicYear, semester }
 */
export async function getOfferings(filters = {}) {
    let query = db
        .from('registration_offerings')
        .select('*')
        .eq('academic_year', filters.academicYear || DEFAULT_ACADEMIC_YEAR)
        .eq('semester', filters.semester || DEFAULT_SEMESTER)
        .order('created_at', { ascending: false });

    if (filters.category) query = query.eq('category', filters.category);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.teacherId) query = query.eq('teacher_id', filters.teacherId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * 4. ครูสร้างหรือแก้ไขรายวิชาเลือกเสรี / ชุมนุม
 */
export async function saveOffering(offeringData) {
    if (offeringData.id) {
        const { id, ...updateFields } = offeringData;
        const { data, error } = await db
            .from('registration_offerings')
            .update({ ...updateFields, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    } else {
        const { data, error } = await db
            .from('registration_offerings')
            .insert([{
                academic_year: offeringData.academic_year || DEFAULT_ACADEMIC_YEAR,
                semester: offeringData.semester || DEFAULT_SEMESTER,
                ...offeringData
            }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }
}

/**
 * 5. ลบรายวิชา / ชุมนุม
 */
export async function deleteOffering(offeringId) {
    const { error } = await db
        .from('registration_offerings')
        .delete()
        .eq('id', offeringId);
    if (error) throw error;
    return true;
}

/**
 * 6. ฝ่ายวิชาการอนุมัติ / ปฏิเสธ รายวิชาหรือชุมนุม
 */
export async function updateOfferingStatus(offeringId, status) {
    const { data, error } = await db
        .from('registration_offerings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', offeringId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * 7. ดึงข้อมูลการลงทะเบียนปัจจุบันของนักเรียน (1 คน ต่อ 1 หมวดหมู่)
 */
export async function getStudentCurrentRegistration(studentId, category = 'ELECTIVE', academicYear = DEFAULT_ACADEMIC_YEAR, semester = DEFAULT_SEMESTER) {
    const { data, error } = await db
        .from('student_registrations')
        .select(`
            *,
            offering:registration_offerings(*)
        `)
        .eq('student_id', studentId)
        .eq('category', category)
        .eq('academic_year', academicYear)
        .eq('semester', semester)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * 8. นักเรียนกดลงทะเบียน (เรียกใช้ RPC ล็อกที่นั่งแบบ Real-time ป้องกันที่นั่งเกิน)
 */
export async function registerStudent(studentInfo, offeringId, enrollType = 'self') {
    const { data, error } = await db.rpc('register_student_offering', {
        p_student_id: studentInfo.student_id,
        p_student_name: studentInfo.student_name,
        p_classroom: studentInfo.classroom,
        p_offering_id: offeringId,
        p_enroll_type: enrollType
    });

    if (error) throw error;
    return data; // { success: boolean, message: string, offering_title?: string }
}

/**
 * 9. นักเรียนหรือแอดมินกดยกเลิกการลงทะเบียน (คืนที่นั่งอัตโนมัติ)
 */
export async function cancelStudentRegistration(studentId, category = 'ELECTIVE', forceAdmin = false, academicYear = DEFAULT_ACADEMIC_YEAR, semester = DEFAULT_SEMESTER) {
    const { data, error } = await db.rpc('cancel_student_offering', {
        p_student_id: studentId,
        p_category: category,
        p_academic_year: academicYear,
        p_semester: semester,
        p_force_admin: forceAdmin
    });

    if (error) throw error;
    return data; // { success: boolean, message: string }
}

/**
 * 10. ดึงรายชื่อนักเรียนทั้งหมดที่ลงทะเบียนในวิชา/ชุมนุมนั้น (สำหรับครูและฝ่ายวิชาการ)
 */
export async function getEnrolledStudentsByOffering(offeringId) {
    const { data, error } = await db
        .from('student_registrations')
        .select('*')
        .eq('offering_id', offeringId)
        .order('classroom', { ascending: true })
        .order('student_id', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * 11. ระบบจัดสรรอัตโนมัติ (Auto-Assign) สำหรับนักเรียนที่ยังไม่ได้ลงทะเบียนหลังหมดเขต
 */
export async function autoAssignUnregisteredStudents(category = 'ELECTIVE', academicYear = DEFAULT_ACADEMIC_YEAR, semester = DEFAULT_SEMESTER) {
    // 1. ดึงรายชื่อนักเรียนทั้งหมดในระบบ
    const { data: allStudents, error: stuErr } = await db
        .from('students')
        .select('student_code, prefix, first_name, last_name, classroom');
    if (stuErr) throw stuErr;

    // 2. ดึงรายชื่อนักเรียนที่ลงทะเบียนในหมวดหมู่นี้แล้ว
    const { data: registered, error: regErr } = await db
        .from('student_registrations')
        .select('student_id')
        .eq('category', category)
        .eq('academic_year', academicYear)
        .eq('semester', semester);
    if (regErr) throw regErr;

    const registeredSet = new Set((registered || []).map(r => r.student_id));
    const unregistered = (allStudents || []).filter(s => !registeredSet.has(s.student_code));

    if (unregistered.length === 0) {
        return { assignedCount: 0, remainingCount: 0, message: 'นักเรียนทุกคนลงทะเบียนครบเรียบร้อยแล้ว' };
    }

    // 3. ดึงรายวิชาที่อนุมัติแล้วและยังมีที่นั่งว่าง
    let offerings = await getOfferings({ category, status: 'approved', academicYear, semester });
    offerings = offerings.filter(o => o.enrolled_count < o.max_seats);

    let assignedCount = 0;

    for (const stu of unregistered) {
        const grade = (stu.classroom || '').split('/')[0];
        // หาวิชาที่ตรงระดับชั้นและยังมีที่นั่งว่าง (เรียงจากวิชาที่คนน้อยสุดก่อนเพื่อกระจายให้สมดุล)
        offerings.sort((a, b) => a.enrolled_count - b.enrolled_count);
        const match = offerings.find(o => o.enrolled_count < o.max_seats && (o.target_grades || []).includes(grade));

        if (match) {
            const fullName = `${stu.prefix || ''}${stu.first_name || ''} ${stu.last_name || ''}`.trim();
            const res = await registerStudent({
                student_id: stu.student_code,
                student_name: fullName,
                classroom: stu.classroom
            }, match.id, 'auto');

            if (res && res.success) {
                match.enrolled_count += 1;
                assignedCount++;
            }
        }
    }

    return {
        assignedCount,
        remainingCount: unregistered.length - assignedCount,
        message: `จัดสรรสำเร็จ ${assignedCount} คน` + (unregistered.length - assignedCount > 0 ? ` (คงเหลือที่นั่งไม่พอ ${unregistered.length - assignedCount} คน)` : '')
    };
}
