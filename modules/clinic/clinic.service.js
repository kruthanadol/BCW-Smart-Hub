import { db } from '../../core/supabase-client.js';

/**
 * 1. ดึงรายการบันทึกห้องพยาบาลล่าสุดพร้อมข้อมูลนักเรียน
 */
export async function fetchClinicRecords(limit = 20) {
    try {
        const { data, error } = await db
            .from('clinic_records')
            .select(`
                id,
                student_id,
                symptom,
                action_taken,
                status,
                check_in,
                created_at,
                students (
                    student_id,
                    prefix,
                    first_name,
                    last_name,
                    classroom
                )
            `)
            .order('check_in', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching clinic records:', err.message);
        return [];
    }
}

/**
 * 2. ค้นหาข้อมูลนักเรียนแบบ Real-time ด้วย Student ID
 */
export async function searchStudentById(studentId) {
    if (!studentId) return null;
    try {
        const { data, error } = await db
            .from('students')
            .select('student_id, prefix, first_name, last_name, classroom')
            .eq('student_id', studentId.trim())
            .maybeSingle();

        if (error || !data) return null;

        const p = data.prefix || '';
        const f = data.first_name || '';
        const l = data.last_name || '';

        return {
            student_id: data.student_id,
            name: `${p}${f} ${l}`.trim(),
            classroom: data.classroom || '-'
        };
    } catch (err) {
        console.error('Search student error:', err.message);
        return null;
    }
}

/**
 * 3. บันทึกข้อมูลการเข้าใช้ห้องพยาบาลใหม่
 */
export async function saveClinicRecord({ studentId, eventType, symptomDetail }) {
    try {
        const combinedSymptom = symptomDetail ? `[${eventType}] ${symptomDetail}` : `[${eventType}]`;
        
        const { data, error } = await db
            .from('clinic_records')
            .insert([
                {
                    student_id: studentId.trim(),
                    symptom: combinedSymptom,
                    action_taken: 'พักผ่อนห้องพยาบาล',
                    status: 'resting',
                    check_in: new Date().toISOString()
                }
            ])
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Save clinic record error:', err.message);
        return { success: false, message: err.message };
    }
}

/**
 * 4. คำนวณสรุปสถิติสำหรับนำไปแสดงบน Key Metrics & Charts
 */
export function processClinicStats(records) {
    const todayStr = new Date().toISOString().split('T')[0];

    let todayCount = 0;
    let accidentCount = 0;
    let activeCount = 0;

    const typeCounts = {
        'ไม่สบาย': 0,
        'ปัญหาสุขภาพ': 0,
        'อุบัติเหตุ': 0
    };

    records.forEach(rec => {
        const checkInDate = rec.check_in ? rec.check_in.split('T')[0] : (rec.created_at ? rec.created_at.split('T')[0] : '');
        
        // เช็กเคสวันนี้
        if (checkInDate === todayStr) {
            todayCount++;
        }

        // เช็กเคสอุบัติเหตุ
        if (rec.symptom && rec.symptom.includes('อุบัติเหตุ')) {
            accidentCount++;
            typeCounts['อุบัติเหตุ']++;
        } else if (rec.symptom && rec.symptom.includes('สุขภาพ')) {
            typeCounts['ปัญหาสุขภาพ']++;
        } else {
            typeCounts['ไม่สบาย']++;
        }

        // เช็กกำลังพัก
        if (rec.status === 'resting' || !rec.status) {
            activeCount++;
        }
    });

    return {
        todayCount,
        accidentCount,
        activeCount,
        typeCounts
    };
}
