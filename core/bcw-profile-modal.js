/**
 * BCW Smart Hub - Standalone Self-Service Profile Popup (Student & Teacher)
 * แยกทำงานอิสระ เรียกใช้ได้ทุกหน้าโดยไม่รบกวนโค้ดเดิม
 */
(function () {
    const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    let selectedCompressedBlob = null;
    let currentProfileContext = null;

    function injectProfileModalHTML() {
        if (document.getElementById('bcwProfileModalBackdrop')) return;

        const html = `
        <div id="bcwProfileModalBackdrop" class="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[10050] hidden flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity" onclick="if(event.target.id==='bcwProfileModalBackdrop') closeBcwProfileModal()">
            <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-[slideUpFromBottom_0.3s_ease-out]" onclick="event.stopPropagation()">
                
                <!-- Header -->
                <div class="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 px-4 py-3.5 text-white flex items-center justify-between border-b-2 border-amber-400">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/60 text-amber-300 flex items-center justify-center text-sm">
                            <i class="fa-solid fa-user-pen"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-amber-300 leading-tight">จัดการโปรไฟล์ส่วนตัว</h3>
                            <p class="text-[11px] text-indigo-200">เปลี่ยนรูปประจำตัวและข้อมูลติดต่อ</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeBcwProfileModal()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center cursor-pointer">✕</button>
                </div>

                <!-- Body -->
                <form id="bcwProfileForm" class="p-4 space-y-3.5 text-xs max-h-[82vh] overflow-y-auto">
                    
                    <!-- Avatar Upload Preview -->
                    <div class="flex flex-col items-center text-center space-y-2 pt-1">
                        <div class="relative group cursor-pointer" onclick="document.getElementById('bcwProfileFileInput').click()">
                            <img id="bcwModalAvatarPreview" src="${DEFAULT_AVATAR}" alt="Profile Preview" class="w-24 h-24 rounded-3xl object-cover border-2 border-indigo-200 shadow-md bg-slate-100" onerror="this.src='${DEFAULT_AVATAR}'">
                            <div class="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-indigo-700 text-white border-2 border-white shadow flex items-center justify-center text-xs">
                                <i class="fa-solid fa-camera"></i>
                            </div>
                        </div>
                        <input type="file" id="bcwProfileFileInput" accept="image/*" class="hidden">
                        <div class="space-y-0.5">
                            <button type="button" onclick="document.getElementById('bcwProfileFileInput').click()" class="text-indigo-700 font-bold hover:underline cursor-pointer">
                                เลือกรูปภาพใหม่ / ถ่ายรูป
                            </button>
                            <p class="text-[10.5px] text-slate-500">ใช้รูปถ่ายหน้าตรงสุภาพ เห็นใบหน้าชัดเจน (ระบบย่อขนาดให้อัตโนมัติ)</p>
                        </div>
                    </div>

                    <!-- Read-only Official Info -->
                    <div class="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 space-y-1.5">
                        <div class="flex justify-between items-center">
                            <span class="text-slate-500">ชื่อ - นามสกุล</span>
                            <span id="bcwModalFullName" class="font-bold text-slate-900">-</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span id="bcwModalCodeLabel" class="text-slate-500">รหัสประจำตัว</span>
                            <span id="bcwModalCodeValue" class="font-semibold text-indigo-800 font-mono">-</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span id="bcwModalSubLabel" class="text-slate-500">สังกัด / ชั้นเรียน</span>
                            <span id="bcwModalSubValue" class="font-semibold text-slate-800">-</span>
                        </div>
                        <p class="text-[10px] text-slate-400 pt-1 border-t border-slate-200/70">
                            <i class="fa-solid fa-lock mr-1"></i>ข้อมูลทะเบียนไม่สามารถแก้ไขเองได้ หากสะกดผิดกรุณาแจ้งครูที่ปรึกษาหรือแอดมิน
                        </p>
                    </div>

                    <!-- Editable Contact Info -->
                    <div class="space-y-2.5">
                        <div>
                            <label for="bcwModalPhoneInput" class="font-semibold text-slate-700 block mb-1">
                                <i class="fa-solid fa-phone text-emerald-600 mr-1"></i>เบอร์โทรศัพท์ติดต่อ
                            </label>
                            <input type="tel" id="bcwModalPhoneInput" placeholder="เช่น 08X-XXX-XXXX" class="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:outline-none rounded-xl px-3 py-2 text-xs font-medium">
                        </div>
                    </div>

                    <!-- Status Message -->
                    <div id="bcwProfileSaveStatus" class="hidden p-2.5 rounded-xl text-center font-semibold text-[11.5px]"></div>

                    <!-- Actions -->
                    <div class="pt-1 flex gap-2">
                        <button type="button" onclick="closeBcwProfileModal()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition">
                            ยกเลิก
                        </button>
                        <button type="submit" id="bcwProfileSaveBtn" class="flex-1 py-2.5 bg-indigo-800 hover:bg-indigo-900 text-white rounded-xl font-bold shadow-md cursor-pointer transition flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูล
                        </button>
                    </div>
                </form>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        bindModalEvents();
    }

    // ย่อขนาดและบีบอัดรูปภาพฝั่งผู้ใช้ (เหลือ ~30-50 KB)
    function compressImageToBlob(file, maxSize = 320, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width;
                    let h = img.height;

                    // ครอปจัตุรัสตรงกลางเพื่อให้รูปโปรไฟล์ไม่เบี้ยว
                    const minSide = Math.min(w, h);
                    const sx = (w - minSide) / 2;
                    const sy = (h - minSide) / 2;

                    canvas.width = maxSize;
                    canvas.height = maxSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxSize, maxSize);

                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('ไม่สามารถประมวลผลรูปภาพได้'));
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'));
                img.src = event.target.result;
            };
            reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
            reader.readAsDataURL(file);
        });
    }

    function bindModalEvents() {
        const fileInput = document.getElementById('bcwProfileFileInput');
        fileInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const blob = await compressImageToBlob(file, 320, 0.82);
                selectedCompressedBlob = blob;
                const previewUrl = URL.createObjectURL(blob);
                document.getElementById('bcwModalAvatarPreview').src = previewUrl;
            } catch (err) {
                alert(err.message);
            }
        });

        document.getElementById('bcwProfileForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveBcwProfileChanges();
        });
    }

    window.openBcwProfileModal = async function () {
        injectProfileModalHTML();
        selectedCompressedBlob = null;

        const statusEl = document.getElementById('bcwProfileSaveStatus');
        if (statusEl) statusEl.classList.add('hidden');
        
        let sessionUser = window.AuthManager ? AuthManager.getCurrentUser() : null;
        if (!sessionUser) {
            const raw = localStorage.getItem('bcw_user_session') || sessionStorage.getItem('bcw_user_session');
            if (raw) sessionUser = JSON.parse(raw);
        }
        if (!sessionUser) {
            alert('ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
            return;
        }

        const role = String(sessionUser.role || '').toLowerCase();
        const isTeacher = role === 'teacher' || role === 'admin' || role === 'staff' || Boolean(sessionUser.teacherId || sessionUser.teacher_id);
        const userCode = String(
            isTeacher
                ? (sessionUser.teacherId || sessionUser.teacher_id || sessionUser.ref_id || sessionUser.id || '')
                : (sessionUser.studentId || sessionUser.student_id || sessionUser.id || '')
        ).trim();

        currentProfileContext = {
            isTeacher,
            userCode,
            email: String(sessionUser.email || '').trim().toLowerCase(),
            sessionUser
        };

        document.getElementById('bcwModalFullName').textContent = sessionUser.name || '-';
        document.getElementById('bcwModalCodeLabel').textContent = isTeacher ? 'รหัสประจำตัวครู' : 'รหัสนักเรียน';
        document.getElementById('bcwModalCodeValue').textContent = userCode || '-';
        document.getElementById('bcwModalSubLabel').textContent = isTeacher ? 'ตำแหน่ง / กลุ่มสาระ' : 'ชั้นเรียน / เลขที่';
        document.getElementById('bcwModalSubValue').textContent = isTeacher
            ? (sessionUser.department || 'ครูผู้สอน')
            : `${document.getElementById('student-class')?.textContent || '-'} (เลขที่ ${document.getElementById('student-no')?.textContent || '-'})`;

        const currentAvatarEl = document.getElementById('student-avatar') || document.getElementById('teacher-avatar');
        document.getElementById('bcwModalAvatarPreview').src = currentAvatarEl?.src || sessionUser.avatar || DEFAULT_AVATAR;

        // ดึงข้อมูลล่าสุด (เบอร์โทร / รูป) จาก Supabase
        const client = window.supabaseClient || window.db || window.supabase;
        if (client && userCode) {
            try {
                if (isTeacher) {
                    const { data: tRow } = await client.from('teachers').select('*').eq('teacher_id', userCode).maybeSingle();
                    if (tRow) {
                        if (tRow.phone || tRow.tel) document.getElementById('bcwModalPhoneInput').value = tRow.phone || tRow.tel;
                        if (tRow.avatar_url || tRow.photo_url) document.getElementById('bcwModalAvatarPreview').src = tRow.avatar_url || tRow.photo_url;
                    }
                } else {
                    const { data: sRow } = await client.from('students').select('*').eq('student_id', userCode).maybeSingle();
                    if (sRow) {
                        const fullName = `${sRow.prefix || ''}${sRow.first_name || ''} ${sRow.last_name || ''}`.trim();
                        if (fullName) document.getElementById('bcwModalFullName').textContent = fullName;
                        if (sRow.phone || sRow.tel) document.getElementById('bcwModalPhoneInput').value = sRow.phone || sRow.tel;
                        if (sRow.avatar_url || sRow.photo_url) document.getElementById('bcwModalAvatarPreview').src = sRow.avatar_url || sRow.photo_url;
                    }
                }
            } catch (e) {}
        }

        document.getElementById('bcwProfileModalBackdrop').classList.remove('hidden');
    };

    window.closeBcwProfileModal = function () {
        const modal = document.getElementById('bcwProfileModalBackdrop');
        if (modal) modal.classList.add('hidden');
    window.openProfilePopup = window.openBcwProfileModal;
    };

async function saveBcwProfileChanges() {
        const btn = document.getElementById('bcwProfileSaveBtn');
        const statusEl = document.getElementById('bcwProfileSaveStatus');
        const phoneVal = document.getElementById('bcwModalPhoneInput').value.trim();
        const client = window.supabaseClient || window.db || window.supabase;

        if (!client || !currentProfileContext) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
        statusEl.classList.add('hidden');

        try {
            const { isTeacher, userCode, email } = currentProfileContext;
            let newAvatarUrl = null;

            // 1. อัปโหลดรูปขึ้น Supabase Storage Bucket 'avatars' (ถ้ามีการเลือกรูปใหม่)
            if (selectedCompressedBlob) {
                const folder = isTeacher ? 'teachers' : 'students';
                const safeCode = String(userCode || 'user').replace(/[^a-zA-Z0-9_-]/g, '');
                const filePath = `${folder}/${safeCode}.jpg`;

                const { error: uploadErr } = await client.storage
                    .from('avatars')
                    .upload(filePath, selectedCompressedBlob, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadErr) throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + uploadErr.message);

                const { data: pubData } = client.storage.from('avatars').getPublicUrl(filePath);
                newAvatarUrl = `${pubData.publicUrl}?t=${Date.now()}`;
            }

            // 2. อัปเดตข้อมูลลงฐานข้อมูลแบบแยกทีละฟิลด์ (ป้องกัน Error 400 หากบางตารางไม่มีคอลัมน์ phone)
            if (isTeacher) {
                // หาเรคคอร์ดครูจริงก่อน เพื่อรู้ว่าต้องอัปเดตด้วยคอลัมน์ไหน (teacher_id หรือ id)
                const { data: tMatch } = await client
                    .from('teachers')
                    .select('*')
                    .or(`teacher_id.eq.${userCode},id.eq.${userCode}`)
                    .maybeSingle();

                if (tMatch) {
                    const matchCol = tMatch.teacher_id ? 'teacher_id' : 'id';
                    const matchVal = tMatch.teacher_id || tMatch.id;

                    if (newAvatarUrl) {
                        await client.from('teachers').update({ avatar_url: newAvatarUrl }).eq(matchCol, matchVal);
                    }
                    if (phoneVal !== '' && 'phone' in tMatch) {
                        await client.from('teachers').update({ phone: phoneVal }).eq(matchCol, matchVal);
                    } else if (phoneVal !== '' && 'tel' in tMatch) {
                        await client.from('teachers').update({ tel: phoneVal }).eq(matchCol, matchVal);
                    }
                }

                // อัปเดตตาราง users (ถ้ามี)
                if (newAvatarUrl) {
                    const userFilter = email ? `email.eq.${email}` : `id.eq.${userCode}`;
                    await client.from('users').update({ avatar_url: newAvatarUrl }).or(userFilter);
                }
            } else {
                if (newAvatarUrl) {
                    await client.from('students').update({ avatar_url: newAvatarUrl }).eq('student_id', userCode);
                    if (email) {
                        await client.from('users').update({ avatar_url: newAvatarUrl }).eq('email', email);
                    }
                }
                if (phoneVal !== '') {
                    await client.from('students').update({ phone: phoneVal }).eq('student_id', userCode);
                }
            }

            // 3. เปลี่ยนรูปบนหน้าเว็บทันทีโดยไม่แตะต้องโครงสร้าง Session ล็อกอิน
            if (newAvatarUrl) {
                ['student-avatar', 'teacher-avatar', 'headerTeacherAvatar'].forEach(id => {
                    const imgEl = document.getElementById(id);
                    if (imgEl) imgEl.src = newAvatarUrl;
                });
            }

            statusEl.className = 'p-2.5 rounded-xl text-center font-semibold text-[11.5px] bg-emerald-50 text-emerald-800 border border-emerald-200';
            statusEl.textContent = '✅ บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว';
            statusEl.classList.remove('hidden');

            setTimeout(() => {
                closeBcwProfileModal();
            }, 900);
        } catch (err) {
            statusEl.className = 'p-2.5 rounded-xl text-center font-semibold text-[11.5px] bg-rose-50 text-rose-800 border border-rose-200';
            statusEl.textContent = '❌ ' + (err.message || 'เกิดข้อผิดพลาดในการบันทึก');
            statusEl.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูล';
        }
    }
})();
