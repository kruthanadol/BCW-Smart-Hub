// modules/academic/grading-system.service.js
import { db, cleanStr } from '../../core/supabase-client.js';

// ดึงผลการเรียน/คะแนนเก็บของนักเรียนรายบุคคล
export async function fetchStudentGrades(studentId, academicYear = '2569') {
    try {
        const { data, error } = await db
            .from('grades')
            .select('*, courses(*)')
            .eq('student_id', cleanStr(studentId))
            .eq('academic_year', academicYear);

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error fetching student grades:', e);
        return [];
    }
}

// คำนวณเกรดเฉลี่ยประจำภาคเรียน (GPA)
export function calculateGPA(gradeList) {
    if (!gradeList || gradeList.length === 0) return '0.00';
    
    let totalPoints = 0;
    let totalCredits = 0;

    gradeList.forEach(g => {
        const credit = parseFloat(g.courses?.credits || 1.0);
        const gradeValue = parseFloat(g.grade || 0);
        if (!isNaN(gradeValue)) {
            totalPoints += gradeValue * credit;
            totalCredits += credit;
        }
    });

    return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
}