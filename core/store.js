// core/store.js
// เก็บ State ชั่วคราวของแอปพลิเคชัน (Global App State)
export const state = {
    currentUser: null,
    currentRole: null, // 'admin', 'teacher', 'clinic', 'student_affairs', 'parent'
    activeClassroom: null
};

export function setCurrentUser(user, role) {
    state.currentUser = user;
    state.currentRole = role;
    localStorage.setItem('bcw_user', JSON.stringify(user));
    localStorage.setItem('bcw_role', role);
}

export function getCurrentUser() {
    if (!state.currentUser) {
        const storedUser = localStorage.getItem('bcw_user');
        const storedRole = localStorage.getItem('bcw_role');
        if (storedUser) {
            state.currentUser = JSON.parse(storedUser);
            state.currentRole = storedRole;
        }
    }
    return { user: state.currentUser, role: state.currentRole };
}

export function clearUserSession() {
    state.currentUser = null;
    state.currentRole = null;
    localStorage.removeItem('bcw_user');
    localStorage.removeItem('bcw_role');
}