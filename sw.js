// BCW Smart Hub - Service Worker v2.1
const CACHE_NAME = 'bcw-smart-hub-v2';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// 🔔 รองรับการรับ Push Notification & ตั้งค่า Badge ตัวเลขบนไอคอน
self.addEventListener('push', (event) => {
    let data = { title: 'BCW Smart Hub Notification', body: 'มีการอัปเดตข้อมูลใหม่', badgeCount: 1 };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    // 1. ตั้งค่าจุด/ตัวเลขสีแดงบนไอคอนแอป (App Badge API)
    if ('setAppBadge' in navigator) {
        navigator.setAppBadge(data.badgeCount || 1).catch((err) => console.error('Badge error:', err));
    }

    // 2. แสดงการแจ้งเตือนเด้งบนหน้าจอ (Notification API)
    const options = {
        body: data.body,
        icon: '/assets/images/logo_bcw.png',
        badge: '/assets/images/logo_bcw.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/apps/parent-app/parent.html' }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// 🖱️ เมื่อผู้ปกครองกดที่การแจ้งเตือน ให้เปิดหน้าแอป
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow(event.notification.data.url || '/apps/parent-app/parent.html');
        })
    );
});