// modules/ai-gate/gate-sync.service.js
import { db, cleanStr } from '../../core/supabase-client.js';
import { sendPushNotification } from '../../core/push-notification.js';

// บันทึกข้อมูลการสแกนใบหน้าจากกล้อง Smart Gate
export async function processGateScan({ studentId, scanType = 'in', methodVal = 'ai_gate' }) {
    try {
        const cleanId = cleanStr(studentId);
        const nowIso = new Date().toISOString();

        const record = {
            student_id: cleanId,
            method: methodVal,
            recorded_at: nowIso,
            created_at: nowIso
        };

        if (scanType === 'in') {
            record.gate_in_time = nowIso;
            record.status = 'present'; // หรือ 'late' ตามช่วงเวลา
        } else if (scanType === 'out') {
            record.gate_out_time = nowIso;
            record.status = 'gatepass';
        }

        const { data, error } = await db.from('attendance_logs').insert([record]).select();
        if (error) throw error;

        return { success: true, data };
    } catch (e) {
        console.error('Error processing gate scan:', e);
        return { success: false, message: e.message };
    }
}

        // 2. ถ้าเป็นสแกนเข้าเช้า (In) ให้ซิงก์ลงตาราง attendance กลาง
        if (scanType === 'in') {
            const isLate = timeStr > '08:00'; // สายหลัง 08:00 น.
            const statusVal = isLate ? 'late' : 'present';

            await db.from('attendance').upsert([{
                student_id: cleanId,
                date: todayStr,
                status: statusVal,
                remark: `สแกนประตูเวลา ${timeStr} น.`,
                updated_at: now.toISOString()
            }], { onConflict: 'student_id,date' });

            // 3. ยิง Push Notification แจ้งผู้ปกครองทันที
            await sendPushNotification({
                targetUser: cleanId,
                title: isLate ? '🔔 แจ้งเตือนการเข้าโรงเรียน (สาย)' : '🔔 แจ้งเตือนการเข้าโรงเรียน',
                body: `นักเรียนสแกนใบหน้าเข้าโรงเรียนแล้ว เวลา ${timeStr} น. (${isLate ? 'สาย' : 'ตรงเวลา'})`
            });
        } else if (scanType === 'out') {
            // สแกนออกเย็น
            await sendPushNotification({
                targetUser: cleanId,
                title: '🚪 แจ้งเตือนการเดินทางออกจากโรงเรียน',
                body: `นักเรียนสแกนใบหน้าเดินทางออกจากโรงเรียนแล้ว เวลา ${timeStr} น.`
            });
        }

        return { success: true, time: timeStr };
    } catch (e) {
        console.error('Error processing gate scan:', e);
        return { success: false, message: e.message };
    }
}
// บันทึกการสแกนใบหน้าจากกล้องประจำห้องเรียน (Smart Classroom AI Scanner)
export async function processClassroomScan({ studentId, classroom, subjectId, periodNo }) {
    try {
        const cleanId = cleanStr(studentId);
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();

        // บันทึกสถานะมาเรียนประจำคาบจากกล้องสแกนประจำห้อง
        const { error } = await db.from('attendance').upsert([{
            student_id: cleanId,
            date: todayStr,
            subject_id: subjectId,
            status: 'present',
            remark: `สแกนกล้องประจำห้องเรียน (${classroom}) คาบที่ ${periodNo}`,
            updated_at: now.toISOString()
        }], { onConflict: 'student_id,date,subject_id' });

        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error processing classroom scan:', e);
        return { success: false, message: e.message };
    }
}