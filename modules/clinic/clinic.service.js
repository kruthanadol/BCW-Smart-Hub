// modules/clinic/clinic.service.js
import { db, cleanStr } from '../../core/supabase-client.js';

/**
 * 1. ดึงประวัติการเข้าใช้ห้องพยาบาลทั้งหมด พร้อมข้อมูลนักเรียน
 */
export async function fetchClinicRecords() {
    try {
        const { data, error } = await db
            .from('clinic_records')
            .select('*, students(prefix, first_name, last_name, classroom)')
            .order('check_in', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error in fetchClinicRecords:', err);
        return [];
    }
}

/**
 * 2. ค้นหาข้อมูลนักเรียนจากรหัสนักเรียน (สำหรับค้นหาแบบ Real-time)
 */
export async function searchStudentById(studentId) {
    if (!studentId) return null;
    try {
        const { data, error } = await db
            .from('students')
            .select('prefix, first_name, last_name, classroom')
            .eq('student_id', cleanStr(studentId))
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        const p = data.prefix || '';
        const f = data.first_name || '';
        const l = data.last_name || '';

        return {
            name: `${p}${f} ${l}`.trim(),
            classroom: data.classroom || '-'
        };
    } catch (err) {
        console.error('Error in searchStudentById:', err);
        return null;
    }
}

/**
 * 3. บันทึกข้อมูลการเข้าใช้ห้องพยาบาลใหม่
 */
export async function saveClinicRecord({ studentId, eventType, symptomDetail }) {
    try {
        const cleanedId = cleanStr(studentId);
        const fullSymptom = symptomDetail ? `${eventType}: ${symptomDetail}` : eventType;

        const { data, error } = await db.from('clinic_records').insert([{
            student_id: cleanedId,
            symptom: fullSymptom,
            status: 'in_clinic',
            check_in: new Date().toISOString()
        }]).select();

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Error in saveClinicRecord:', err);
        return { success: false, message: err.message };
    }
}

/**
 * 4. ประมวลผลสถิติและเตรียมข้อมูลสำหรับ Dashboard & Charts
 */
export function processClinicStats(records) {
    let todayCount = 0;
    let accidentCount = 0;
    let activeCount = 0;
    let typeCounts = { 'ไม่สบาย': 0, 'ปัญหาสุขภาพ': 0, 'อุบัติเหตุ': 0 };

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    records.forEach(rec => {
        const recDate = rec.check_in ? new Date(rec.check_in) : (rec.created_at ? new Date(rec.created_at) : null);
        const dateStr = recDate ? `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, '0')}-${String(recDate.getDate()).padStart(2, '0')}` : '';
        
        if (dateStr === todayStr) todayCount++;
        if (rec.symptom && (rec.symptom.includes('อุบัติเหตุ') || rec.symptom.includes('เกิดอุบัติเหตุ'))) accidentCount++;
        if (rec.status === 'in_clinic' || rec.status === 'resting') activeCount++;

        if (rec.symptom) {
            if (rec.symptom.includes('อุบัติเหตุ')) typeCounts['อุบัติเหตุ']++;
            else if (rec.symptom.includes('ปัญหาสุขภาพ')) typeCounts['ปัญหาสุขภาพ']++;
            else typeCounts['ไม่สบาย']++;
        }
    });

    return {
        todayCount,
        accidentCount,
        activeCount,
        typeCounts
    };
}