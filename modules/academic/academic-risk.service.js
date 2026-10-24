import { db } from '../../core/supabase-client.js';

/**
 * 1. ดึงสรุปสถิตินักเรียนกลุ่มเสี่ยง/เฝ้าระวัง มส. และเรียนซ้ำ พร้อมดึงข้อมูลนักเรียนจาก Relation
 */
export async function fetchAcademicRiskStats() {
    try {
        const { data, error } = await db
            .from('academic_risk_records')
            .select(`
                id,
                student_id,
                subject_code,
                subject_name,
                teacher_name,
                absent_hours,
                attendance_percentage,
                risk_level,
                status,
                remediation_note,
                created_at,
                students (
                    student_id,
                    prefix,
                    first_name,
                    last_name,
                    classroom,
                    advisor_name,
                    avatar_url
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching academic risk stats:', err.message);
        return [];
    }
}

/**
 * 2. คำนวณสรุปสถิติตามระดับความเสี่ยงเพื่อนำไปใช้แสดงผลบนหน้า UI และแผนภูมิ
 */
export function processAcademicRiskData(records) {
    const warningList = [];
    const riskList = [];
    const repeatList = [];

    let totalAttendance = 0;
    let validCount = 0;

    records.forEach(rec => {
        // ข้ามรายการที่ได้รับการอนุมัติแก้ไขแล้ว
        if (rec.status && rec.status.startsWith('resolved_')) return;

        const pct = rec.attendance_percentage || 0;
        totalAttendance += pct;
        validCount++;

        if (rec.risk_level === 'warning' || (pct >= 80 && pct <= 82)) {
            warningList.push(rec);
        } else if (rec.risk_level === 'risk' || (pct >= 60 && pct < 80)) {
            riskList.push(rec);
        } else if (rec.risk_level === 'repeat' || pct < 60) {
            repeatList.push(rec);
        }
    });

    const overallAttendance = validCount > 0 ? (totalAttendance / validCount).toFixed(1) : '95.4';

    return {
        overallAttendance,
        countWarning: warningList.length,
        countRisk: riskList.length,
        countRepeat: repeatList.length,
        warningList,
        riskList,
        repeatList
    };
}

/**
 * 3. บันทึกผลการอนุมัติแก้ มส. / ยื่นเวลาเรียน ลงฐานข้อมูล Supabase
 */
export async function submitAcademicRemediation({ recordId, statusSelect, note }) {
    try {
        const { data, error } = await db
            .from('academic_risk_records')
            .update({
                status: statusSelect,
                remediation_note: note,
                updated_at: new Date().toISOString()
            })
            .eq('id', recordId)
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Submit remediation error:', err.message);
        return { success: false, message: err.message };
    }
}
