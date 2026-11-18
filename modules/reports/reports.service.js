const db = window.db;

export async function getTeachersList() {
    try {
        let { data } = await db.from('users').select('full_name').eq('role', 'teacher');
        if (!data || data.length === 0) {
            const fallback = await db.from('teachers').select('full_name, name');
            data = fallback.data || [];
        }
        if (data && data.length > 0) {
            return data.map(t => t.full_name || t.name).filter(Boolean);
        }
        return ["นายสมชาย ใจดี", "นางสาวศิริพร วิทยา", "นายอนันต์ ภาษาไทย"];
    } catch (err) {
        console.error('Error fetching teachers list:', err);
        return ["นายสมชาย ใจดี"];
    }
}

export async function generateMasterReportData({ selectedClass }) {
    try {
        // 1. ดึงรายชื่อนักเรียนเรียงตามรหัสนักเรียน
        let stdQuery = db.from('students')
            .select('id, student_id, first_name, last_name, classroom, behavior_score, advisor_name')
            .order('student_id', { ascending: true });

        if (selectedClass && selectedClass !== 'ALL') {
            stdQuery = stdQuery.eq('classroom', selectedClass);
        }
        const { data: students, error: stdErr } = await stdQuery;
        if (stdErr) throw stdErr;
        if (!students || students.length === 0) return { dates: [], rows: [] };

        const studentIds = students.flatMap(s => [s.student_id, s.id]).filter(Boolean);

        // 2. ดึงประวัติการเช็คชื่อและประวัติอื่นๆ
        const [attRes, behaveRes, clinicRes, notifRes] = await Promise.all([
            db.from('attendance_logs').select('*').in('student_id', studentIds),
            db.from('behavior_logs').select('*').in('student_id', studentIds),
            db.from('clinic_records').select('*').in('student_id', studentIds),
            db.from('parent_notifications').select('*').in('student_id', studentIds)
        ]);

        const attLogs = attRes.data || [];
        const behaviorLogs = behaveRes.data || [];
        const clinicLogs = clinicRes.data || [];
        const parentNotifs = notifRes.data || [];

        // 3. รวบรวมวันที่/คาบเรียนทั้งหมดที่มีการเช็คชื่อจริง (รองรับทั้งคอลัมน์ date, check_date, created_at)
        const getLogDateKey = (log) => {
            const rawDate = log.date || log.check_date || log.attendance_date || log.created_at;
            if (!rawDate) return null;
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return String(rawDate).slice(0, 10);
            return d.toISOString().slice(0, 10); // YYYY-MM-DD
        };

        const uniqueDates = [...new Set(attLogs.map(getLogDateKey).filter(Boolean))].sort();

        // แปลงวันที่เป็นรูปแบบสั้นสำหรับหัวตาราง เช่น "18/11"
        const dateColumns = uniqueDates.map(isoDate => {
            const [y, m, d] = isoDate.split('-');
            return {
                key: isoDate,
                label: d && m ? `${parseInt(d)}/${parseInt(m)}` : isoDate
            };
        });

        // 4. สร้างข้อมูลรายคนพร้อมตารางเช็คชื่อรายวัน
        const rows = students.map(std => {
            const fullName = `${std.first_name || ''} ${std.last_name || ''}`.trim();
            const sId = std.student_id || std.id;
            const myAtt = attLogs.filter(l => l.student_id === std.student_id || l.student_id === std.id);

            let presentCount = 0; // มา (/)
            let lateCount = 0;    // สาย (ส)
            let leaveCount = 0;   // ลา (ล)
            let absentCount = 0;  // ขาด (ข)
            let truantCount = 0;  // หนีเรียน (ห)

            // สร้าง Map สถานะรายวันของนักเรียนคนนี้
            const dailyMap = {};
            dateColumns.forEach(col => {
                const found = myAtt.find(l => getLogDateKey(l) === col.key);
                if (!found) {
                    dailyMap[col.key] = '-';
                    return;
                }
                const st = (found.status || '').toLowerCase();
                if (st === 'present' || st === 'มา' || st === '/') {
                    dailyMap[col.key] = '/';
                    presentCount++;
                } else if (st === 'late' || st === 'สาย' || st === 'ส') {
                    dailyMap[col.key] = 'ส';
                    lateCount++;
                } else if (st === 'leave' || st === 'ลา' || st === 'ล') {
                    dailyMap[col.key] = 'ล';
                    leaveCount++;
                } else if (st === 'truant' || st === 'หนีเรียน' || st === 'ห') {
                    dailyMap[col.key] = 'ห';
                    truantCount++;
                } else {
                    dailyMap[col.key] = 'ข';
                    absentCount++;
                }
            });

            const totalRecorded = dateColumns.length;
            const totalAttended = presentCount + lateCount; // มา + สาย นับเป็นเวลาเรียน
            const attPercent = totalRecorded > 0 ? Math.round((totalAttended / totalRecorded) * 100) : 100;

            return {
                student_id: sId,
                student_name: fullName,
                class: std.classroom || selectedClass,
                daily_map: dailyMap,
                present_count: presentCount,
                late_count: lateCount,
                leave_count: leaveCount,
                absent_count: absentCount,
                truant_count: truantCount,
                attended_periods: totalAttended,
                total_periods: totalRecorded,
                attendance_percent: attPercent,
                behavior_score: std.behavior_score ?? 100,
                clinic_count: clinicLogs.filter(c => c.student_id === sId || c.student_id === std.id).length,
                notif_count: parentNotifs.filter(n => n.student_id === sId || n.student_id === std.id).length
            };
        });

        return { dates: dateColumns, rows };
    } catch (err) {
        console.error("Error in generateMasterReportData:", err);
        throw err;
    }
}
