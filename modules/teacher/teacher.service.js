// modules/teacher/teacher.service.js
import { TeacherProfileService } from './teacher-profile.service.js';
import { AttendanceService } from './attendance.service.js';
import { HomeworkAssignService } from './homework-assign.service.js';

export const TeacherService = {
    // 1. ดึงโปรไฟล์/การมอบหมายวิชา
    getTeacherProfile: (teacherId) => TeacherProfileService.getProfile(teacherId),
    getAssignedCourses: (teacherId) => TeacherProfileService.getCourses(teacherId),
    
    // 2. งานเช็กชื่อ
    getStudentsByClass: (className) => AttendanceService.getStudents(className),
    submitAttendance: (data) => AttendanceService.saveAttendance(data),

    // 3. งานการบ้าน
    assignHomework: (data) => HomeworkAssignService.createHomework(data)
};
