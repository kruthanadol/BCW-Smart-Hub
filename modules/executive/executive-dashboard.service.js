import { db, cleanStr } from '../../core/supabase-client.js';

/**
 * ดึงข้อมูลสถิติภาพรวมสำหรับผู้บริหาร (Executive Overview Stats)
 */
export async function getExecutiveStats() {
    try {
        // 1. ดึงจำนวนนักเรียนทั้งหมด
        const { count: totalStudents } = await db.from('students').select('*', { count: 'exact', head: true });

        // 2. ดึงประวัติเข้าเรียนทั้งหมด
        const { data: attData } = await db.from('attendance_logs').select('*');

        const totalStatusCounts = [0, 0, 0, 0, 0]; // [PRESENT, LATE, LEAVE, ABSENT, TRUANT]
        const statusMap = { 'PRESENT': 0, 'GREEN': 0, 'LATE': 1, 'LEAVE': 2, 'ABSENT': 3, 'TRUANT': 4 };
        const gradeStatusCounts = {
            'ม.1': [0, 0, 0, 0, 0], 'ม.2': [0, 0, 0, 0, 0], 'ม.3': [0, 0, 0, 0, 0],
            'ม.4': [0, 0, 0, 0, 0], 'ม.5': [0, 0, 0, 0, 0], 'ม.6': [0, 0, 0, 0, 0]
        };
        const roomWatchlistMap = {};

        if (attData) {
            attData.forEach(row => {
                const st = (row.status || '').toUpperCase();
                const idx = statusMap[st];
                if (idx !== undefined) {
                    totalStatusCounts[idx]++;

                    const classroom = row.classroom || '';
                    const gradeMatch = classroom.match(/ม\.[1-6]/);
                    if (gradeMatch && gradeStatusCounts[gradeMatch[0]]) {
                        gradeStatusCounts[gradeMatch[0]][idx]++;
                    }

                    if (st === 'ABSENT' || st === 'TRUANT') {
                        if (!roomWatchlistMap[classroom]) {
                            roomWatchlistMap[classroom] = { absent: 0, truant: 0, grade: gradeMatch ? gradeMatch[0] : '' };
                        }
                        if (st === 'ABSENT') roomWatchlistMap[classroom].absent++;
                        if (st === 'TRUANT') roomWatchlistMap[classroom].truant++;
                    }
                }
            });
        }

        const totalLogs = totalStatusCounts.reduce((a, b) => a + b, 0);
        const presentLogs = totalStatusCounts[0] + totalStatusCounts[1];
        const attRate = totalLogs > 0 ? ((presentLogs / totalLogs) * 100).toFixed(1) : '0.0';

        // 3. ดึงจำนวนนักเรียนกลุ่มเสี่ยงติด มส. (<82%)
        const { count: riskCount } = await db.from('v_academic_attendance_risk').select('*', { count: 'exact', head: true });

        // 4. ดึงการบ้านที่สั่งแล้ว
        const { data: homeworks } = await db.from('homework_assignments').select('*');

        return {
            totalStudents: totalStudents || 0,
            attendanceRate: attRate,
            truancyCount: totalStatusCounts[4],
            riskCount: riskCount || 0,
            homeworkCount: homeworks ? homeworks.length : 0,
            totalStatusCounts,
            gradeStatusCounts,
            roomWatchlistMap,
            homeworks: homeworks || []
        };
    } catch (err) {
        console.error('Error fetching executive stats:', err);
        throw err;
    }
}

/**
 * เพิ่มข้อมูลนักเรียนใหม่
 */
export async function addStudent({ prefix, studentId, firstName, lastName, classroom }) {
    try {
        const { data, error } = await db.from('students').insert([{
            prefix: cleanStr(prefix),
            student_id: cleanStr(studentId),
            first_name: cleanStr(firstName),
            last_name: cleanStr(lastName),
            classroom: cleanStr(classroom)
        }]);

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Error adding student:', err);
        return { success: false, message: err.message };
    }
}