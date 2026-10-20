// core/push-notification.js
export async function sendPushNotification({ targetUser, title, body, payload = {} }) {
    console.log(`[Push Notification] To: ${targetUser} | Title: ${title} | Body: ${body}`);
    // รองรับการเชื่อมต่อกับ Firebase Cloud Messaging (FCM) หรือ Web Push API ในอนาคต
    try {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/assets/images/logo_bcw.png' });
        }
        return { success: true };
    } catch (e) {
        console.error('Push notification failed:', e);
        return { success: false, error: e.message };
    }
}