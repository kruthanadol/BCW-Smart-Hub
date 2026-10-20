// modules/student-affairs/leave-approval.service.js
import { db, cleanStr } from '../../core/supabase-client.js';
import { sendPushNotification } from '../../core/push-notification.js';

// ดึงรายการขอออกนอกโรงเรียนที่รออนุมัติ
export async function getPendingGatepasses() {
    try {
        const { data, error } = await db
            .from('gate_pass_logs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error fetching gatepass requests:', e);
        return [];
    }
}

// อนุมัติ / ไม่อนุมัติ ใบผ่านประตู
export async function updateGatepassStatus(requestId, status, approvedByUuid) {
    try {
        const nowIso = new Date().toISOString();

        // 1. อัปเดตในตาราง gate_pass_logs
        const { data: requestData, error: updateErr } = await db
            .from('gate_pass_logs')
            .update({
                status: status, // 'approved' หรือ 'rejected'
                approved_by: approvedByUuid
            })
            .eq('id', requestId)
            .select()
            .single();

        if (updateErr) throw updateErr;

        // 2. เมื่ออนุมัติ -> ซิงก์ลง attendance_logs ให้ครูประจำวิชาเห็น
        if (status === 'approved' && requestData) {
            await db.from('attendance_logs').insert([{
                student_id: requestData.student_id,
                status: 'gatepass',
                method: 'manual',
                recorded_at: nowIso,
                location: 'ประตูโรงเรียน',
                created_at: nowIso
            }]);

            // แจ้งเตือนผู้ปกครอง
            await sendPushNotification({
                targetUser: requestData.student_id,
                title: '🚪 แจ้งเตือนใบอนุญาตออกนอกโรงเรียน',
                body: `ใบผ่านประตูได้รับการอนุมัติเรียบร้อยแล้ว (เหตุผล: ${requestData.reason || 'กิจจำเป็น'})`
            });
        }

        return { success: true, data: requestData };
    } catch (e) {
        console.error('Error updating gatepass status:', e);
        return { success: false, message: e.message };
    }
}