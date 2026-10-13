importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDPqxT33WtgZda4FSXXB_XvrsuRA7PEpfc",
  authDomain: "smart-school-app-8741a.firebaseapp.com",
  projectId: "smart-school-app-8741a",
  storageBucket: "smart-school-app-8741a.firebasestorage.app",
  messagingSenderId: "143647920204",
  appId: "1:143647920204:web:48f2df5ee048592f9464e9"
});

const messaging = firebase.messaging();

// รับข้อความตอนปิดหน้าเว็บ/สลับแอป
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://cdn-icons-png.flaticon.com/512/2991/2991112.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});