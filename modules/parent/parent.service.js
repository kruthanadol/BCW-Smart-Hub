import { db } from '../../core/supabase-client.js';

/**
 * ดึงข้อมูลโปรไฟล์นักเรียน
 */
export async function getStudentProfile(studentId) {
    try {
        const { data, error } = await db
            .from('students')
            .select('*')
            .eq('student_id', studentId)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Error fetching student profile:', err);
        return null;
    }
}

/**
 * ดึงสถานะการเข้าประตูโรงเรียนยามเช้า (Smart Gate Status)
 */
export async function getTrafficGateStatus(studentId) {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data, error } = await db
            .from('attendance_logs')
            .select('*')
            .eq('student_id', studentId)
            .gte('created_at', `${todayStr}T00:00:00`)
            .order('created_at', { ascending: false })
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    } catch (err) {
        console.error('Error fetching gate status:', err);
        return null;
    }
}

/**
 * ดึงข้อมูลเสี่ยงติด มส. (เวลาเรียนไม่ถึง 80%)
 */
export async function getAcademicRisks(studentId) {
    try {
        const { data, error } = await db
            .from('v_academic_attendance_risk')
            .select('*')
            .eq('student_id', studentId);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching academic risks:', err);
        return [];
    }
}

/**
 * ดึงตารางเรียนตามชั้นเรียนและวัน
 */
export async function getStudentSchedule(className, dayOfWeek) {
    try {
        const { data, error } = await db
            .from('schedules')
            .select('*')
            .eq('class_name', className)
            .eq('day_of_week', dayOfWeek)
            .order('period_no', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching schedule:', err);
        return [];
    }
}

/**
 * ดึงครูที่ปรึกษาประจำห้องเรียน
 */
export async function getClassAdvisors(className) {
    try {
        const { data, error } = await db
            .from('class_advisors')
            .select('*, users(full_name, email)')
            .eq('class_name', className);

        if (error) throw error;
        
        return (data || []).map(a => ({
            teacher_name: a.users ? a.users.full_name : a.teacher_id,
            teacher_id: a.teacher_id,
            advisor_type: a.advisor_type
        }));
    } catch (err) {
        console.error('Error fetching advisors:', err);
        return [];
    }
}

/**
 * ดึงประวัติการยื่นใบลาออนไลน์
 */
export async function getLeaveHistory(studentId) {
    try {
        const { data, error } = await db
            .from('leave_requests')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching leave history:', err);
        return [];
    }
}

/**
 * ดึงข้อความแจ้งเตือนจากครู
 */
export async function getTeacherNotifications(studentId) {
    try {
        const { data, error } = await db
            .from('notifications')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching notifications:', err);
        return [];
    }
}

/**
 * ดึงประวัติห้องพยาบาล
 */
export async function getClinicHistory(studentId) {
    try {
        const { data, error } = await db
            .from('clinic_logs')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching clinic history:', err);
        return [];
    }
}

/**
 * ดึงรายการการบ้านประจำห้อง
 */
export async function getHomeworkAssignments(className) {
    try {
        const { data, error } = await db
            .from('homework_assignments')
            .select('*')
            .eq('class_name', className)
            .order('due_date', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching homework:', err);
        return [];
    }
}

/**
 * สรุปสถิติการมาเรียน (มา/สาย/ขาด/หนี)
 */
export async function getAttendanceStats(studentId) {
    try {
        const { data, error } = await db
            .from('attendance_logs')
            .select('status')
            .eq('student_id', studentId);

        if (error) throw error;

        const stats = { present: 0, late: 0, absent: 0, truant: 0 };
        (data || []).forEach(log => {
            const st = (log.status || '').toUpperCase();
            if (st === 'PRESENT') stats.present++;
            else if (st === 'LATE') stats.late++;
            else if (st === 'ABSENT') stats.absent++;
            else if (st === 'TRUANT') stats.truant++;
        });

        return stats;
    } catch (err) {
        console.error('Error fetching attendance stats:', err);
        return { present: 0, late: 0, absent: 0, truant: 0 };
    }
}

/**
 * ดึงประวัติคะแนนพฤติกรรม
 */
export async function getBehaviorLogs(studentId) {
    try {
        const { data, error } = await db
            .from('behavior_logs')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching behavior logs:', err);
        return [];
    }
}

/**
 * ยื่นใบลาออนไลน์โดยผู้ปกครอง
 */
export async function submitParentLeaveRequest({ studentId, className, leaveType, startDate, endDate, reason, parentPhone, parentPin }) {
    try {
        const { data, error } = await db.from('leave_requests').insert([{
            student_id: studentId,
            class_name: className,
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            reason: reason,
            parent_phone: parentPhone,
            parent_pin: parentPin,
            status: 'pending',
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Error submitting leave request:', err);
        return { success: false, message: err.message };
    }
}
/**
 * 🔔 ขอสิทธิ์การแจ้งเตือนจากเบราว์เซอร์
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('เบราว์เซอร์นี้ไม่รองรับ Notification');
        return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

/**
 * 🔴 ตั้งค่าตัวเลขแจ้งเตือนบนไอคอนแอป (App Badge)
 */
export async function setAppBadgeCount(count = 1) {
    try {
        if ('setAppBadge' in navigator) {
            await navigator.setAppBadge(count);
        } else if ('setExperimentalAppBadge' in navigator) {
            await navigator.setExperimentalAppBadge(count);
        }
    } catch (err) {
        console.error('Error setting App Badge:', err);
    }
}

/**
 * 🧹 ล้างตัวเลข/จุดสีแดงบนไอคอนแอปออก (เมื่อผู้ปกครองเปิดดูแอปแล้ว)
 */
export async function clearAppBadgeCount() {
    try {
        if ('clearAppBadge' in navigator) {
            await navigator.clearAppBadge();
        } else if ('clearExperimentalAppBadge' in navigator) {
            await navigator.clearExperimentalAppBadge();
        }
    } catch (err) {
        console.error('Error clearing App Badge:', err);
    }
}