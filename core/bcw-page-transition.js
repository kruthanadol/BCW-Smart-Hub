/**
 * BCW Smart Hub - Global Instant Splash & Transition Curtain
 * เรียกใช้บรรทัดเดียวใน <head> แสดงวงแหวนคู่สีเขียว-ทองรอบโลโก้ทันทีตั้งแต่ 0ms
 */
(function () {
    const REPO_PREFIX = window.location.pathname.includes('/BCW-Smart-Hub') ? '/BCW-Smart-Hub' : '';
    const LOGO_URL = `${REPO_PREFIX}/assets/images/logo_bcw.png`;
    const FALLBACK_LOGO = 'https://raw.githubusercontent.com/kruthanadol/BCW-Smart-Hub/main/assets/images/logo_bcw.png';
    const isLoginPage = window.location.pathname.endsWith('login.html');

    // 1. ฉีด CSS ตั้งแต่เสี้ยววินาทีแรกใน <head>
    const style = document.createElement('style');
    style.id = 'bcw-curtain-style';
    style.textContent = `
        #bcw-global-curtain {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            background: radial-gradient(circle at center, #065f46 0%, #022c22 62%, #011812 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-family: 'Kanit', sans-serif;
            opacity: 1;
            transition: opacity 0.38s ease, visibility 0.38s ease;
            padding: 24px;
            text-align: center;
        }
        #bcw-global-curtain.fade-out {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }
        .bcw-luxury-orbit {
            position: relative;
            width: 128px;
            height: 128px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 18px;
        }
        .bcw-orbit-glow {
            position: absolute;
            inset: 4px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(251, 191, 36, 0.35) 0%, rgba(16, 185, 129, 0.15) 55%, transparent 75%);
            filter: blur(8px);
            animation: bcwGlowPulse 2s infinite ease-in-out;
        }
        .bcw-ring-outer {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            border: 3.5px solid transparent;
            border-top-color: #fbbf24;
            border-right-color: #10b981;
            border-bottom-color: rgba(251, 191, 36, 0.25);
            box-shadow: 0 0 18px rgba(251, 191, 36, 0.35);
            animation: bcwSpinCW 1.5s linear infinite;
        }
        .bcw-ring-inner {
            position: absolute;
            inset: 9px;
            border-radius: 50%;
            border: 2.5px solid transparent;
            border-top-color: #34d399;
            border-left-color: #fde68a;
            border-bottom-color: rgba(52, 211, 153, 0.2);
            animation: bcwSpinCCW 1.1s linear infinite;
        }
        .bcw-curtain-logo-box {
            position: relative;
            z-index: 2;
            width: 84px;
            height: 84px;
            border-radius: 50%;
            background: #ffffff;
            padding: 10px;
            border: 2px solid #f59e0b;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .bcw-curtain-logo-box img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .bcw-curtain-title {
            font-size: 21px;
            font-weight: 800;
            background: linear-gradient(90deg, #fde68a 0%, #fbbf24 50%, #f59e0b 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: 0.8px;
            margin: 0;
        }
        .bcw-curtain-sub {
            font-size: 12px;
            color: #a7f3d0;
            margin-top: 4px;
        }
        .bcw-curtain-pill {
            margin-top: 18px;
            background: rgba(2, 44, 34, 0.85);
            border: 1px solid rgba(251, 191, 36, 0.35);
            padding: 8px 20px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
            color: #fef3c7;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .bcw-dot-pulse {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #34d399;
            box-shadow: 0 0 8px #34d399;
            animation: bcwDotBlink 1.2s infinite ease-in-out;
        }
        @keyframes bcwSpinCW { to { transform: rotate(360deg); } }
        @keyframes bcwSpinCCW { to { transform: rotate(-360deg); } }
        @keyframes bcwGlowPulse {
            0%, 100% { transform: scale(0.96); opacity: 0.75; }
            50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes bcwDotBlink {
            0%, 100% { opacity: 0.4; transform: scale(0.85); }
            50% { opacity: 1; transform: scale(1.15); }
        }
    `;
    document.head.appendChild(style);

    // 2. สร้าง HTML ฉากกั้นทันทีก่อน <body> จะโหลดเสร็จ (ไม่เกิดอาการหน้าขาวหรือหน้าล็อกอินโผล่แวบ)
    const curtainHTML = `
        <div id="bcw-global-curtain">
            <div class="bcw-luxury-orbit">
                <div class="bcw-orbit-glow"></div>
                <div class="bcw-ring-outer"></div>
                <div class="bcw-ring-inner"></div>
                <div class="bcw-curtain-logo-box">
                    <img src="${LOGO_URL}" alt="BCW Logo" onerror="this.src='${FALLBACK_LOGO}'">
                </div>
            </div>
            <h2 class="bcw-curtain-title">BCW SMART HUB</h2>
            <p class="bcw-curtain-sub">โรงเรียนบัวเชดวิทยา &bull; ระบบสารสนเทศอัจฉริยะ</p>
            <div class="bcw-curtain-pill">
                <span class="bcw-dot-pulse"></span>
                <span id="bcw-curtain-msg">กำลังโหลดระบบ กรุณารอสักครู่...</span>
            </div>
        </div>
    `;

    // แทรกทันทีผ่าน document.write หากสคริปต์อยู่ใน <head>
    if (document.readyState === 'loading') {
        document.write(curtainHTML);
    }

    function ensureCurtain() {
        let el = document.getElementById('bcw-global-curtain');
        if (!el && document.body) {
            document.body.insertAdjacentHTML('afterbegin', curtainHTML);
            el = document.getElementById('bcw-global-curtain');
        }
        return el;
    }

    // ฟังก์ชันเปิดฉากกั้น (เรียกใช้ได้ทุกที่ เช่น window.showBCWCurtain('กำลังเข้าสู่ระบบ...'))
    window.showBCWCurtain = function (message = 'กำลังเข้าสู่ระบบ กรุณารอสักครู่...') {
        sessionStorage.setItem('bcw_transitioning', '1');
        const el = ensureCurtain();
        if (!el) return;
        const msgEl = document.getElementById('bcw-curtain-msg');
        if (msgEl) msgEl.textContent = message;
        el.classList.remove('fade-out');
        el.style.display = 'flex';
    };

    // ฟังก์ชันปิดฉากกั้น
    window.hideBCWCurtain = function () {
        sessionStorage.removeItem('bcw_transitioning');
        const el = document.getElementById('bcw-global-curtain');
        if (!el) return;
        el.classList.add('fade-out');
        setTimeout(() => { el.style.display = 'none'; }, 400);
    };

    // 3. จัดการเปิดม่านอัตโนมัติเมื่อหน้าโหลดพร้อม
    window.addEventListener('load', () => {
        const params = new URLSearchParams(window.location.search);
        const hasOAuthCallback = params.has('code') || params.has('state') || window.location.hash.includes('access_token');
        const hasStoredSession = Boolean(localStorage.getItem('bcw_user') || sessionStorage.getItem('bcw_user'));

        if (isLoginPage && (hasOAuthCallback || hasStoredSession)) {
            // ถ้าอยู่หน้า login แต่มี Session / กำลังกลับจาก LINE ให้แสดงข้อความกำลังเข้าสู่ระบบค้างไว้
            const msgEl = document.getElementById('bcw-curtain-msg');
            if (msgEl) msgEl.textContent = 'กำลังเข้าสู่ระบบอัตโนมัติ กรุณารอสักครู่...';
            setTimeout(window.hideBCWCurtain, 4500); // สำรองกรณี Session หมดอายุ
        } else {
            // หน้าอื่นๆ เปิดม่านออกอย่างนุ่มนวลหลังโหลดเสร็จ
            setTimeout(window.hideBCWCurtain, 350);
        }
    });

    // 4. กางฉากกั้นทันทีเมื่อกดปุ่ม Submit ล็อกอินหรือคลิกลิงก์เปลี่ยนหน้าหลัก
    document.addEventListener('submit', () => {
        window.showBCWCurtain('กำลังยืนยันตัวตนเข้าสู่ระบบ...');
    }, true);
})();
