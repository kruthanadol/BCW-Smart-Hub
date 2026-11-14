/**
 * BCW Smart Hub - Global Anti-Flicker & Smooth Transition Curtain
 * ป้องกันการเห็นหน้า Login ระหว่างรอตรวจสอบสิทธิ์หรือเปลี่ยนหน้าเมื่ออินเทอร์เน็ตช้า
 */
(function () {
    const REPO_PREFIX = window.location.pathname.includes('/BCW-Smart-Hub') ? '/BCW-Smart-Hub' : '';
    const LOGO_URL = `${REPO_PREFIX}/assets/images/logo_bcw.png`;
    const FALLBACK_LOGO = 'https://raw.githubusercontent.com/kruthanadol/BCW-Smart-Hub/main/assets/images/logo_bcw.png';

    // 1. ตรวจสอบทันทีตั้งแต่ยังไม่โหลด <body> ว่าอยู่ในสถานะกำลังล็อกอินหรือมี Session อยู่หรือไม่
    const params = new URLSearchParams(window.location.search);
    const isLoginPage = window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('/');
    const hasOAuthCallback = params.has('code') || params.has('state') || window.location.hash.includes('access_token');
    const isRedirectingFlag = sessionStorage.getItem('bcw_transitioning') === '1';

    // ตรวจหา Session ใน localStorage / sessionStorage (รองรับทั้ง AuthManager และ Supabase)
    let hasStoredSession = Boolean(localStorage.getItem('bcw_user') || sessionStorage.getItem('bcw_user'));
    if (!hasStoredSession) {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) || '';
            if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
                hasStoredSession = true;
                break;
            }
        }
    }

    // ถ้าอยู่หน้า login แล้วมี Session หรือกำลัง Redirect ให้กางม่านบังตั้งแต่ก่อนวาดหน้าจอ
    const shouldShowImmediately = isRedirectingFlag || (isLoginPage && (hasOAuthCallback || hasStoredSession));

    // 2. ฉีด CSS ฉากกั้นเข้าไปใน <head> ทันที (ทำงานก่อน <body> เรนเดอร์ 100%)
    const style = document.createElement('style');
    style.id = 'bcw-curtain-style';
    style.textContent = `
        #bcw-global-curtain {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            background: radial-gradient(circle at top, #065f46 0%, #022c22 65%, #011c16 100%);
            display: ${shouldShowImmediately ? 'flex' : 'none'};
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-family: 'Kanit', sans-serif;
            opacity: ${shouldShowImmediately ? '1' : '0'};
            transition: opacity 0.35s ease;
            padding: 24px;
            text-align: center;
        }
        #bcw-global-curtain.fade-out {
            opacity: 0;
            pointer-events: none;
        }
        .bcw-curtain-logo-box {
            width: 88px;
            height: 88px;
            border-radius: 24px;
            background: #ffffff;
            padding: 10px;
            border: 2.5px solid #fbbf24;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 0 24px rgba(251, 191, 36, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
            animation: bcwPulse 1.8s infinite ease-in-out;
        }
        .bcw-curtain-logo-box img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .bcw-curtain-title {
            font-size: 20px;
            font-weight: 800;
            color: #fbbf24;
            letter-spacing: 0.5px;
            margin: 0;
        }
        .bcw-curtain-sub {
            font-size: 12px;
            color: #a7f3d0;
            margin-top: 4px;
        }
        .bcw-curtain-pill {
            margin-top: 20px;
            background: rgba(2, 44, 34, 0.75);
            border: 1px solid rgba(52, 211, 153, 0.35);
            padding: 8px 18px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
            color: #ecfdf5;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .bcw-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid #fbbf24;
            border-top-color: transparent;
            border-radius: 50%;
            animation: bcwSpin 0.8s linear infinite;
        }
        @keyframes bcwSpin { to { transform: rotate(360deg); } }
        @keyframes bcwPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.04); }
        }
    `;
    document.head.appendChild(style);

    function ensureCurtainElement() {
        let el = document.getElementById('bcw-global-curtain');
        if (!el && document.body) {
            el = document.createElement('div');
            el.id = 'bcw-global-curtain';
            el.innerHTML = `
                <div class="bcw-curtain-logo-box">
                    <img src="${LOGO_URL}" alt="BCW Logo" onerror="this.src='${FALLBACK_LOGO}'">
                </div>
                <h2 class="bcw-curtain-title">BCW SMART HUB</h2>
                <p class="bcw-curtain-sub">โรงเรียนบัวเชดวิทยา &bull; ระบบสารสนเทศอัจฉริยะ</p>
                <div class="bcw-curtain-pill">
                    <span class="bcw-spinner"></span>
                    <span id="bcw-curtain-msg">กำลังเชื่อมต่อเข้าสู่ระบบ กรุณารอสักครู่...</span>
                </div>
            `;
            document.body.prepend(el);
        }
        return el;
    }

    // ฟังก์ชันเปิดฉากกั้น (เรียกใช้ได้จากทุกหน้า)
    window.showBCWCurtain = function (message = 'กำลังเข้าสู่ระบบ กรุณารอสักครู่...') {
        sessionStorage.setItem('bcw_transitioning', '1');
        const el = ensureCurtainElement();
        if (!el) return;
        const msgEl = document.getElementById('bcw-curtain-msg');
        if (msgEl) msgEl.textContent = message;
        el.classList.remove('fade-out');
        el.style.display = 'flex';
        requestAnimationFrame(() => { el.style.opacity = '1'; });
    };

    // ฟังก์ชันเปิดม่านออกเมื่อหน้าปลายทางพร้อมแล้ว
    window.hideBCWCurtain = function () {
        sessionStorage.removeItem('bcw_transitioning');
        const el = document.getElementById('bcw-global-curtain');
        if (!el) return;
        el.classList.add('fade-out');
        setTimeout(() => { el.style.display = 'none'; }, 360);
    };

    // สร้าง Element ทันทีที่ DOM พร้อม
    if (document.body) {
        ensureCurtainElement();
    } else {
        document.addEventListener('DOMContentLoaded', ensureCurtainElement);
    }

    // หากอยู่หน้าปลายทาง (เช่น landing.html, teacher.html) ให้เปิดม่านออกอย่างนุ่มนวลเมื่อโหลดเสร็จ
    window.addEventListener('load', () => {
        if (!isLoginPage) {
            setTimeout(window.hideBCWCurtain, 250);
        } else if (shouldShowImmediately) {
            // สำรองกรณีเน็ตหลุดหรือ Session หมดอายุจริง หลัง 5 วินาทีให้เปิดฟอร์มล็อกอิน
            setTimeout(window.hideBCWCurtain, 5000);
        }
    });

    // ดักจับการกดปุ่มล็อกอิน / ส่งฟอร์มอีเมล-รหัสผ่าน ให้กางฉากกั้นทันที
    document.addEventListener('submit', () => {
        window.showBCWCurtain('กำลังยืนยันตัวตนเข้าสู่ระบบ...');
    }, true);
})();
