import { TeacherProfileService } from './teacher-profile.service.js';
import { AttendanceService } from './attendance.service.js';
import { HomeworkAssignService } from './homework-assign.service.js';

export const TeacherService = {
    // --- 1. ข้อมูลโปรไฟล์และภาระงานสอน ---
    async getProfile(teacherId) {
        if (TeacherProfileService?.getProfile) {
            return await TeacherProfileService.getProfile(teacherId);
        }
        return { teacher_id: teacherId, full_name: 'ครูผู้สอน' };
    },

    async getAssignedCourses(teacherId) {
        if (TeacherProfileService?.getCourses) {
            return await TeacherProfileService.getCourses(teacherId);
        }
        return [];
    },

    // --- 2. การเช็กชื่อและจัดการนักเรียน ---
    async getStudentsByClass(className) {
        if (AttendanceService?.getStudents) {
            return await AttendanceService.getStudents(className);
        }
        return [];
    },

    async submitAttendance(attendanceRecords) {
        if (AttendanceService?.saveAttendance) {
            return await AttendanceService.saveAttendance(attendanceRecords);
        }
        return { success: false, message: 'ไม่พบ Service บันทึกการมาเรียน' };
    },

    // --- 3. การมอบหมายการบ้าน ---
    async createHomework(homeworkData) {
        if (HomeworkAssignService?.createHomework) {
            return await HomeworkAssignService.createHomework(homeworkData);
        }
        return { success: false, message: 'ไม่พบ Service การบ้าน' };
    }
};
