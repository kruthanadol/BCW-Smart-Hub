// modules/academic/academic-risk.service.js
import { db } from '../../core/supabase-client.js';

/**
 * 1. ดึงข้อมูลนักเรียนกลุ่มเสี่ยง (เฝ้าระวัง / เสี่ยง มส. / เรียนซ้ำ)
 */
export async function fetchAcademicRiskStudents() {
    try {
        const [sumRes, stdRes] = await Promise.all([
            db.from('academic_attendance_summary').select('*').neq('status', 'resolved'),
            db.from('students').select('*')
        ]);

        if (sumRes.error) throw sumRes.error;

        const studentsMap = {};
        if (stdRes.data) {
            stdRes.data.forEach(s => { studentsMap[s.student_id] = s; });
        }

        return (sumRes.data || []).map(item => {
            const student = studentsMap[item.student_id] || {};
            return {
                ...item,
                student_name: item.student_name || student.name || (student.first_name ? `${student.first_name} ${student.last_name}` : 'ไม่ระบุชื่อ'),
                classroom: item.class || student.classroom || student.class || 'ไม่ระบุห้อง',
                advisor_name: item.advisor_name || student.advisor_name || 'ไม่ระบุ',
                image_url: student.image_url || student.avatar_url || item.image_url || 'https://via.placeholder.com/150'
            };
        });
    } catch (err) {
        console.error('Error in fetchAcademicRiskStudents:', err);
        return [];
    }
}

/**
 * 2. ดึงสถิติอัตราเข้าเรียนเฉลี่ยรวม
 */
export async function getOverallAttendanceAvg() {
    try {
        const { data, error } = await db.from('academic_attendance_summary').select('attendance_percent');
        if (error) throw error;
        if (data && data.length > 0) {
            const total = data.reduce((sum, r) => sum + parseFloat(r.attendance_percent || 0), 0);
            return (total / data.length).toFixed(1);
        }
        return "0.0";
    } catch (err) {
        console.error('Error fetching overall attendance:', err);
        return "0.0";
    }
}

/**
 * 3. ดึงข้อมูลวิชาที่มีนักเรียนกลุ่มเสี่ยงสูงสุด
 */
export async function getTopRiskSubjects() {
    try {
        const { data: attendanceData, error } = await db
            .from('academic_attendance_summary')
            .select('*')
            .neq('status', 'resolved');

        if (error) throw error;

        const { data: studentsData } = await db.from('students').select('*');
        const studentsMap = {};
        if (studentsData) {
            studentsData.forEach(s => { studentsMap[s.student_id] = s; });
        }

        const subjectsGroup = {};

        if (attendanceData && attendanceData.length > 0) {
            attendanceData.forEach(item => {
                const subjectKey = item.subject_code || item.subject_name || 'UNSPECIFIED';
                if (!subjectsGroup[subjectKey]) {
                    subjectsGroup[subjectKey] = {
                        code: item.subject_code || 'ไม่ระบุรหัส',
                        name: item.subject_name || 'ไม่ระบุชื่อวิชา',
                        teacher: item.teacher_name || 'ไม่ระบุครูผู้สอน',
                        warningStudents: [],
                        riskStudents: [],
                        repeatStudents: []
                    };
                }

                const studentDetail = studentsMap[item.student_id] || {};
                const studentInfo = {
                    student_name: item.student_name || studentDetail.name || (studentDetail.first_name ? `${studentDetail.first_name} ${studentDetail.last_name}` : 'ไม่ระบุชื่อ'),
                    classroom: item.class || studentDetail.classroom || studentDetail.class || '-',
                    advisor_name: item.advisor_name || studentDetail.advisor_name || 'ไม่ระบุ'
                };

                const percent = parseFloat(item.attendance_percent || 0);
                if (item.status === 'warning' || (percent >= 80 && percent <= 82)) {
                    subjectsGroup[subjectKey].warningStudents.push(studentInfo);
                } else if (item.status === 'risk' || (percent >= 60 && percent < 80)) {
                    subjectsGroup[subjectKey].riskStudents.push(studentInfo);
                } else if (item.status === 'repeat' || percent < 60) {
                    subjectsGroup[subjectKey].repeatStudents.push(studentInfo);
                }
            });
        }

        return Object.values(subjectsGroup);
    } catch (err) {
        console.error('Error in getTopRiskSubjects:', err);
        return [];
    }
}

/**
 * 4. ดึงข้อมูลการเข้าสอนของครูประจำวัน (Section 7)
 */
export async function getTeacherMonitorData(selectedDate) {
    try {
        const { data: logs, error } = await db
            .from('attendance_logs')
            .select('*')
            .gte('check_in_time', `${selectedDate}T00:00:00`)
            .lte('check_in_time', `${selectedDate}T23:59:59`);

        if (error) throw error;
        if (!logs || logs.length === 0) return [];

        const classMap = {};
        logs.forEach(log => {
            const key = log.classroom || 'ทั่วไป';
            if (!classMap[key]) {
                classMap[key] = {
                    classroom: key,
                    lastTime: new Date(log.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                    count: 0
                };
            }
            classMap[key].count++;
        });

        return Object.values(classMap);
    } catch (err) {
        console.error('Error in getTeacherMonitorData:', err);
        return [];
    }
}

/**
 * 5. บันทึกอนุมัติการแก้ไข มส. / ลงทะเบียนเรียนซ้ำ
 */
export async function submitRemediationData({ recordId, studentId, subjectCode, remediationType, docRef }) {
    try {
        await db.from('remediation_records').insert([{
            student_id: studentId || null,
            subject_code: subjectCode || null,
            remediation_type: remediationType,
            doc_ref: docRef || null,
            recorded_by: 'ฝ่ายวิชาการ'
        }]);

        const { error } = await db
            .from('academic_attendance_summary')
            .update({ status: 'resolved' })
            .eq('id', recordId);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error in submitRemediationData:', err);
        return { success: false, message: err.message };
    }
}