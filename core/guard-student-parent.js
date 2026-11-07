// core/guard-student-parent.js
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        // อ่าน Session จาก Memory ในเครื่องทันที
        const user = window.AuthManager ? AuthManager.getCurrentUser() : null;
        const repoPrefix = window.AuthManager ? AuthManager.getRepoPrefix() : '';

        // กรณีไม่มี Session ให้พาไปหน้า Login เงียบๆ
        if (!user || !user.role) {
            window.location.replace(repoPrefix + '/login.html');
            return;
        }

        const role = (user.role || '').toUpperCase();
        // อนุญาตให้ นักเรียน ผู้ปกครอง ครู และแอดมิน เข้าดูได้
        const allowedRoles = ['STUDENT', 'PARENT', 'ADMIN', 'SUPERADMIN', 'EXECUTIVE', 'TEACHER'];

        if (!allowedRoles.includes(role)) {
            if (window.AuthService && typeof AuthService.redirectToRolePage === 'function') {
                AuthService.redirectToRolePage(role);
            } else {
                window.location.replace(repoPrefix + '/login.html');
            }
        }
    });
})();
