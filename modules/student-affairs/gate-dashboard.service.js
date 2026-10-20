// modules/student-affairs/gate-dashboard.service.js
import { db } from '../../core/supabase-client.js';

// ดึงสรุปสถิติสแกนหน้าประตูประจำวัน
export async function getTodayGateStats() {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
        const { data, error } = await db
            .from('gate_logs')
            .select('*')
            .gte('scanned_at', `${todayStr}T00:00:00`)
            .lte('scanned_at', `${todayStr}T23:59:59`);

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error fetching today gate stats:', e);
        return [];
    }
}