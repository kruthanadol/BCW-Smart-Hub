// core/guard-admin-teacher.js
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        // อ่าน Session จาก Memory ในเครื่องทันที
        const user = window.AuthManager ? AuthManager.getCurrentUser() : null;
        const repoPrefix = window.AuthManager ? AuthManager.getRepoPrefix() : '';

        // กรณีไม่มี Session ค้างอยู่ ให้พาไปหน้า Login เงียบๆ (ไม่มี Alert เด้งกวนใจ)
        if (!user || !user.role) {
            window.location.replace(repoPrefix + '/login.html');
            return;
        }

        const role = (user.role || '').toUpperCase();
        const allowedRoles = ['ADMIN', 'SUPERADMIN', 'EXECUTIVE', 'TEACHER'];

        // กรณีสิทธิ์ไม่ตรง (เช่น นักเรียนหรือผู้ปกครองเปิดเข้ามา) ให้ส่งกลับหน้าประจำบทบาทของเขา
        if (!allowedRoles.includes(role)) {
            if (window.AuthService && typeof AuthService.redirectToRolePage === 'function') {
                AuthService.redirectToRolePage(role);
            } else {
                window.location.replace(repoPrefix + '/login.html');
            }
        }
    });
})();
