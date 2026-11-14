/**
 * BCW Smart Hub - Global Anti-Flicker & Luxury Green-Gold Ring Transition Curtain
 * ป้องกันการเห็นหน้า Login ระหว่างรอตรวจสอบสิทธิ์ พร้อมวงแหวนสีเขียว-ทองหมุนรอบโลโก้
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

    const shouldShowImmediately = isRedirectingFlag || (isLoginPage && (hasOAuthCallback || hasStoredSession));

    // 2. ฉีด CSS ฉากกั้นและวงแหวนหมุนคู่สีเขียว-ทองเข้าไปใน <head> ทันที
    const style = document.createElement('style');
    style.id = 'bcw-curtain-style';
    style.textContent = `
        #bcw-global-curtain {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            background: radial-gradient(circle at center, #065f46 0%, #022c22 62%, #011812 100%);
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

        /* คอนเทนเนอร์วงแหวนหมุนรอบโลโก้ */
        .bcw-luxury-orbit {
            position: relative;
            width: 124px;
            height: 124px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 18px;
        }

        /* แสงออร่าสีทอง-เขียวด้านหลัง */
        .bcw-orbit-glow {
            position: absolute;
            inset: 4px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(251, 191, 36, 0.32) 0%, rgba(16, 185, 129, 0.15) 55%, transparent 75%);
            filter: blur(8px);
            animation: bcwGlowPulse 2.2s infinite ease-in-out;
        }

        /* วงแหวนชั้นนอก (สีทอง-เขียวมรกต หมุนตามเข็มนาฬิกา) */
        .bcw-ring-outer {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            border: 3.5px solid transparent;
            border-top-color: #fbbf24;
            border-right-color: #10b981;
            border-bottom-color: rgba(251, 191, 36, 0.25);
            box-shadow: 0 0 18px rgba(251, 191, 36, 0.35);
            animation: bcwSpinCW 1.6s linear infinite;
        }

        /* วงแหวนชั้นใน (สีเขียวสด-ทองอ่อน หมุนทวนเข็มนาฬิกา) */
        .bcw-ring-inner {
            position: absolute;
            inset: 9px;
            border-radius: 50%;
            border: 2.5px solid transparent;
            border-top-color: #34d399;
            border-left-color: #fde68a;
            border-bottom-color: rgba(52, 211, 153, 0.2);
            animation: bcwSpinCCW 1.15s linear infinite;
        }

        /* กล่องโลโก้วงกลมตรงกลาง */
        .bcw-curtain-logo-box {
            position: relative;
            z-index: 2;
            width: 82px;
            height: 82px;
            border-radius: 50%;
            background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
            padding: 10px;
            border: 2px solid #f59e0b;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), inset 0 2px 4px rgba(255, 255, 255, 0.9);
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
            margin-top: 3px;
            font-weight: 500;
        }
        .bcw-curtain-pill {
            margin-top: 18px;
            background: rgba(2, 44, 34, 0.82);
            border: 1px solid rgba(251, 191, 36, 0.35);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
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

    function ensureCurtainElement() {
        let el = document.getElementById('bcw-global-curtain');
        if (!el && document.body) {
            el = document.createElement('div');
            el.id = 'bcw-global-curtain';
            el.innerHTML = `
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
                    <span id="bcw-curtain-msg">กำลังเชื่อมต่อเข้าสู่ระบบ กรุณารอสักครู่...</span>
                </div>
            `;
            document.body.prepend(el);
        }
        return el;
    }

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

    window.hideBCWCurtain = function () {
        sessionStorage.removeItem('bcw_transitioning');
        const el = document.getElementById('bcw-global-curtain');
        if (!el) return;
        el.classList.add('fade-out');
        setTimeout(() => { el.style.display = 'none'; }, 360);
    };

    if (document.body) {
        ensureCurtainElement();
    } else {
        document.addEventListener('DOMContentLoaded', ensureCurtainElement);
    }

    window.addEventListener('load', () => {
        if (!isLoginPage) {
            setTimeout(window.hideBCWCurtain, 280);
        } else if (shouldShowImmediately) {
            setTimeout(window.hideBCWCurtain, 5000);
        }
    });

    document.addEventListener('submit', () => {
        window.showBCWCurtain('กำลังยืนยันตัวตนเข้าสู่ระบบ...');
    }, true);
})();
