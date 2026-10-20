import { db } from '../../core/supabase-client.js';

/**
 * ดึงและสรุปข้อมูลสถิติภาพรวมผู้บริหารเชิงลึก (Executive Summary Analytic)
 */
export async function getExecutiveSummaryReport() {
    try {
        // 1. ดึงสถิตินักเรียนทั้งหมด
        const { count: totalStudents } = await db.from('students').select('*', { count: 'exact', head: true });

        // 2. ดึงสถิติเข้าเรียน
        const { data: attLogs } = await db.from('attendance_logs').select('status, classroom');
        
        let presentCount = 0;
        let absentCount = 0;
        let truantCount = 0;

        if (attLogs) {
            attLogs.forEach(l => {
                const st = (l.status || '').toUpperCase();
                if (st === 'PRESENT' || st === 'LATE' || st === 'GREEN') presentCount++;
                if (st === 'ABSENT') absentCount++;
                if (st === 'TRUANT') truantCount++;
            });
        }

        const totalLogs = (attLogs || []).length;
        const overallAttendancePercent = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 0;

        // 3. ดึงกลุ่มเสี่ยง มส.
        const { count: riskCount } = await db.from('v_academic_attendance_risk').select('*', { count: 'exact', head: true });

        return {
            generatedDate: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }),
            totalStudents: totalStudents || 0,
            overallAttendancePercent,
            absentCount,
            truantCount,
            riskStudentsCount: riskCount || 0,
            executiveRecommendation: overallAttendancePercent >= 90 
                ? 'ภาพรวมการมาเรียนอยู่ในเกณฑ์ดีเยี่ยม ควรเน้นย้ำการเฝ้าระวังกลุ่มเสี่ยงหนีเรียนเฉพาะรายห้อง' 
                : 'ควรสั่งการฝ่ายกิจการนักเรียนและครูที่ปรึกษา ติดตามนักเรียนกลุ่มเสี่ยงติด มส. อย่างใกล้ชิด'
        };
    } catch (err) {
        console.error('Error generating executive summary:', err);
        throw err;
    }
}