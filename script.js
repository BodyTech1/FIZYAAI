import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser as deleteAuthUser, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, onSnapshot, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// بيانات مشروع فزيائي الخاصة بك
const firebaseConfig = {
    apiKey: "AIzaSyDimAkjqtt8nl4Her0vqtHVMu4xkluUuqs",
    authDomain: "fizyai.firebaseapp.com",
    projectId: "fizyai",
    storageBucket: "fizyai.firebasestorage.app",
    messagingSenderId: "172902934430",
    appId: "1:172902934430:web:ab440e76ef738e5499588f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 1. وظيفة تسجيل طالب جديد ---
window.register = async function () {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const message = document.getElementById("message");

    try {
        // 1. محاولة إنشاء حساب جديد (لو الطالب أول مرة يسجل)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
            name: name,
            email: email,
            status: "pending",
            role: "student"
        });
        message.innerText = "تم إرسال طلبك للمستر بنجاح انتظر 24 ساعه حتي يتم قبول طلبق ثم قم بتسجيل الدخول ✅";
        message.style.color = "green";
    } catch (error) {
        // 2. لو الطالب مسجل قبل كدة (Email already in use)
        if (error.code === 'auth/email-already-in-use') {
            message.innerText = "إيميلك مسجل فعلاً، جاري تحديث طلبك للمستر... ⏳";
            
            try {
                // هنسجل دخوله بالباسورد اللي كتبه عشان نحدث بياناته
                const userLogin = await signInWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, "users", userLogin.user.uid), {
                    name: name,
                    email: email,
                    status: "pending", // بنرجع الحالة لانتظار عشان يظهر للمدرس تاني
                    role: "student"
                });
                message.innerText = "تم إعادة إرسال طلبك، هيظهر للمستر حالاً ✅";
                message.style.color = "blue";
            } catch (loginError) {
                message.innerText = "الباسورد غلط! لو ده إيميلك اكتب الباسورد الصح عشان تبعت طلب جديد.";
                message.style.color = "red";
            }
        } else {
            message.innerText = "خطأ: " + error.message;
            message.style.color = "red";
        }
    }
};

// --- 2. وظيفة تسجيل الدخول ---
window.login = async function() {
    const email = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPassword").value;
    const msg = document.getElementById("message");

    // 1. التحقق إذا كان الداخل هو المدرس (Admin)
    if (email === "admin" && pass === "1234") {
        msg.style.color = "blue";
        msg.innerText = "أهلاً يا مستر ياسر... جاري فتح لوحة التحكم 👨‍🏫";
        // mark local teacher flag so protectPhysicsPlatform allows staying on the page
        localStorage.setItem('isTeacher', 'true');
        setTimeout(() => {
            window.location.href = "teacher.html";
        }, 1000);
        return; // بنوقف الكود هنا عشان ميكملش لباقي الطلاب
    }

    // 2. كود تسجيل دخول الطلاب العاديين (باقي الكود كما هو)
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
        
        if (userDoc.exists() && userDoc.data().status === "approved") {
            localStorage.setItem("userName", userDoc.data().name);
            // Redirect to homepage and show greeting
            window.location.href = "index.html";
        } else {
            alert("حسابك لسه مخدش موافقة يا هندسة ⏳");
            await auth.signOut();
        }
    } catch (e) {
        msg.style.color = "red";
        msg.innerText = "الإيميل أو الباسورد غلط!";
    }
};
// --- 3. عرض الطلاب في لوحة تحكم المدرس ---

// عرض الطلبات الجديدة (Pending)
const pendingTable = document.getElementById("pending-table");
if (pendingTable) {
    const q = query(collection(db, "users"), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        pendingTable.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            pendingTable.innerHTML += `
                <tr>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>
                        <button onclick="approveUser('${docSnap.id}')" style="background:green; color:white;">قبول</button>
                        <button onclick="deleteUser('${docSnap.id}')" style="background:red; color:white;">حذف</button>
                    </td>
                </tr>`;
        });
    });
}

// عرض الطلاب المقبولين (Approved)
const approvedTable = document.getElementById("approved-table");
if (approvedTable) {
    const q = query(collection(db, "users"), where("status", "==", "approved"));
    onSnapshot(q, (snapshot) => {
        approvedTable.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            approvedTable.innerHTML += `
                <tr>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>
                        <button onclick="deleteUser('${docSnap.id}')" style="background:red; color:white;">حذف الطالب</button>
                    </td>
                </tr>`;
        });
    });
}

// دالة الموافقة
window.approveUser = async function(id) {
    await updateDoc(doc(db, "users", id), { status: "approved" });
};

window.deleteUser = async function(id) {
    // حذف فوري بدون رسائل
    await deleteDoc(doc(db, "users", id));
};

// عرض اسم الطالب في صفحة الدروس
if (document.getElementById("welcome-name")) {
    document.getElementById("welcome-name").innerText = "أهلاً بك يا " + localStorage.getItem("userName");
}


function protectPhysicsPlatform() {
    // قائمة الصفحات اللي لازم الطالب يكون مسجل عشان يشوفها
    const privatePages = [
        "class-1.html",
        "class-2.html",
        "class-3.html",
        "exams.html",
        "teacher.html" // اختيارياً لحماية صفحة المدرس برضه
    ]; 
    
    const currentPage = window.location.pathname.split("/").pop();

    if (privatePages.includes(currentPage)) {
        // Allow quick local testing: if `isTeacher` or `userName` exists in localStorage,
        // skip Firebase auth redirect so the teacher page stays open during development.
        const isTeacherLocal = localStorage.getItem('isTeacher') === 'true';
        const userNameLocal = localStorage.getItem('userName');
        if (isTeacherLocal || userNameLocal) {
            return;
        }

        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                // لو حد حاول يدخل وهو مش مسجل، ابعته لصفحة الدخول
                window.location.href = "login.html";
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists() || userDoc.data().status !== 'approved') {
                    // الحساب لم يتم الموافقة عليه بعد
                    alert('حسابك لم يحصل على موافقة المدرس بعد.');
                    await auth.signOut();
                    window.location.href = 'login.html';
                }
            } catch (e) {
                console.error('خطأ في التحقق من حالة المستخدم:', e);
                // عند الخطأ الافتراضي أرسل المستخدم لتسجيل الدخول
                await auth.signOut();
                window.location.href = 'login.html';
            }
        });
    }
}

// تشغيل الحماية
protectPhysicsPlatform();

/* ============================================
   UI Functions (Global)
   ============================================ */

window.checkTeacherLogin = function() {
    const isTeacher = localStorage.getItem('isTeacher') === 'true';
    const dashboardBtn = document.getElementById('teacher-dashboard');
    const logoutBtn = document.getElementById('logout-btn');
    const userName = localStorage.getItem('userName');

    if (isTeacher && dashboardBtn) {
        dashboardBtn.style.display = 'inline-block';
    }

    // Show logout button for teachers or logged-in students
    if (logoutBtn) {
        if (isTeacher || userName) {
            logoutBtn.style.display = 'inline-block';
        } else {
            logoutBtn.style.display = 'none';
        }
    }
};

// Hide sign-in / register links when a user is logged-in
window.toggleAuthLinks = function() {
    const userName = localStorage.getItem('userName');
    const isTeacher = localStorage.getItem('isTeacher') === 'true';

    const loginLinks = document.querySelectorAll('a[href="login.html"]');
    const registerLinks = document.querySelectorAll('a[href="register.html"]');

    const shouldHide = !!userName || isTeacher;

    loginLinks.forEach(a => {
        a.style.display = shouldHide ? 'none' : '';
    });

    registerLinks.forEach(a => {
        a.style.display = shouldHide ? 'none' : '';
    });
};

window.logout = function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('isTeacher');
        localStorage.removeItem('userName');
        location.href = 'index.html';
    }
};

/* ============================================
   Dropdown Menu Handler
   ============================================ */

window.initDropdownMenu = function() {
    const dropdownToggle = document.querySelector('.dropdown > a');
    const dropdownContent = document.querySelector('.dropdown-content');
    
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', function(e) {
            e.preventDefault();
            dropdownContent.classList.toggle('active');
            dropdownToggle.classList.toggle('active');
        });
        
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.dropdown')) {
                dropdownContent.classList.remove('active');
                dropdownToggle.classList.remove('active');
            }
        });
    }
};

/* ============================================
   Page Initialization
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    window.checkTeacherLogin();
    window.initDropdownMenu();
    window.toggleAuthLinks();

    // Show welcome message on index
    if (document.getElementById("welcome-name")) {
        const userName = localStorage.getItem("userName");
        if (userName) {
            document.getElementById("welcome-name").innerText = "أهلاً بك يا " + userName;
        }
    }

    // only load teacher-specific data on teacher page
    const path = location.pathname;
    const isTeacherPage = path.includes('teacher.html');
    
    // ---------- responsive burger menu toggle ----------
    const burgerIcon = document.querySelector('.burger');
    const navItems = document.getElementById('nav-items');
    if (burgerIcon && navItems) {
        burgerIcon.addEventListener('click', () => {
            navItems.classList.toggle('active');
        });
    }
    
    if (isTeacherPage) {
        // Initialize lessons table on teacher page
        const lessonsTable = document.getElementById('lessons-table');
        if (lessonsTable) {
            const lessons = JSON.parse(localStorage.getItem('lessons')) || [];
            const rows = lessonsTable.querySelectorAll('tr');
            if (lessons.length > 0 && rows.length === 1) {
                rows[0].remove();
            }
            
            lessons.forEach(lesson => {
                const classMap = {
                    '1': 'الصف الأول الثانوي',
                    '2': 'الصف الثاني الثانوي',
                    '3': 'الصف الثالث الثانوي'
                };
                
                const newRow = lessonsTable.insertRow();
                newRow.setAttribute('data-id', lesson.id);
                newRow.innerHTML = `
                    <td>${lesson.title}</td>
                    <td>${classMap[lesson.class]}</td>
                    <td>${lesson.description}</td>
                    <td>${lesson.date}</td>
                    <td>
                        <button class="btn btn-warning btn-small" onclick="editLesson(this)">✏️ تعديل</button>
                        <button class="btn btn-danger btn-small" onclick="deleteLesson(this)">🗑️ حذف</button>
                    </td>
                `;
            });
        }

        // Load data from Firestore on initial page load for teacher page only
        if (typeof window.loadExamsFromCloud === 'function') window.loadExamsFromCloud();
        if (typeof window.loadLessonsFromCloud === 'function') window.loadLessonsFromCloud();
        
        // Load teacher's videos
        if (typeof window.loadTeacherVideos === 'function') window.loadTeacherVideos();
        if (typeof window.loadVideosManagementTable === 'function') window.loadVideosManagementTable();
    }
    
    // Load common data for all pages
    if (typeof window.loadMeetingsFromCloud === 'function') window.loadMeetingsFromCloud();
    
    // Check if on index page to load centers properly
    const isIndexPage = !window.location.pathname.includes('.html') || window.location.pathname.includes('index.html');
    if (isIndexPage && typeof window.loadCentersFromCloudIndex === 'function') {
        window.loadCentersFromCloudIndex();
    } else if (typeof window.loadCentersFromCloud === 'function') {
        window.loadCentersFromCloud();
    }
});

/* ============================================
   Lesson Management (Delete & Edit)
   ============================================ */

window.deleteLesson = async function(button) {
    if (!confirm('هل أنت متأكد من حذف هذا الدرس؟')) return;
    
    const row = button.closest('tr');
    const id = row.getAttribute('data-id');
    
    try {
        await deleteDoc(doc(db, 'lessons', id));
        
        let lessons = JSON.parse(localStorage.getItem('lessons') || '[]');
        lessons = lessons.filter(lesson => lesson.id !== id);
        localStorage.setItem('lessons', JSON.stringify(lessons));
        
        row.remove();
        if (typeof window.loadLessonsFromCloud === 'function') window.loadLessonsFromCloud();
        
    } catch (error) {
        console.error('خطأ في الحذف:', error);
        alert('❌ حدث خطأ في حذف الدرس: ' + error.message);
    }
};

window.editLesson = function(button) {
    const row = button.closest('tr');
    const cells = row.querySelectorAll('td');
    
    document.getElementById('lessonTitle').value = cells[0].textContent;
    document.getElementById('lessonClass').value = cells[1].textContent.includes('الأول') ? '1' : cells[1].textContent.includes('الثاني') ? '2' : '3';
    document.getElementById('lessonDescription').value = cells[2].textContent;
    
    window.scrollTo({
        top: document.querySelector('input#lessonTitle').offsetTop - 100, 
        behavior: 'smooth'
    });
    document.getElementById('lessonTitle').focus();
    
    
};

window.joinMeeting = function(link) {
    if (!link) return alert('لا يوجد رابط صالح للاجتماع');
    window.open(link, '_blank');
};

// Play video in a modal
window.openVideoModal = function(videoId, title) {
    let modal = document.getElementById('video-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'video-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.9); display: none; z-index: 100000000;
            align-items: center; justify-content: center;
        `;
        document.body.appendChild(modal);
    }
    
    const iframeContainer = document.createElement('div');
    iframeContainer.style.cssText = `
        position: relative; width: 90%; max-width: 900px; aspect-ratio: 16/9;
        background: #000; border-radius: 8px;
    `;
    
    iframeContainer.innerHTML = `
        <button onclick="closeVideoModal()" style="
            position: absolute; top: 10px; right: 10px; z-index: 10001;
            background: #ff4444; color: white; border: none; padding: 8px 12px;
            border-radius: 4px; cursor: pointer; font-size: 16px;
        ">✕</button>
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000; pointer-events: auto; border-radius: 8px;" id="video-modal-overlay"></div>
        <iframe 
            width="100%" height="100%" 
            src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
            frameborder="0" allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            style="border-radius: 8px;">
        </iframe>
    `;
    
    modal.innerHTML = '';
    modal.appendChild(iframeContainer);
    modal.style.display = 'flex';
    
    // Protect the overlay from right-click
    const overlay = document.getElementById('video-modal-overlay');
    if (overlay) {
        overlay.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); return false; }, true);
        overlay.addEventListener('mousedown', (e) => { if (e.button === 2) { e.preventDefault(); e.stopPropagation(); } }, true);
    }
    
    // Close modal when clicking outside the iframe
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeVideoModal();
        }
    };
};

// Close video modal
window.closeVideoModal = function() {
    const modal = document.getElementById('video-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Protected YouTube player using IFrame API + overlays + watermark
// This creates a protected modal player. To change the video, call
// `openProtectedPlayer(videoId, title, description, pdfUrl)`
window.openProtectedPlayer = function(videoId, title = '', description = '', pdfUrl = '') {
    try {
        // Ensure unique modal
        let modal = document.getElementById('protected-video-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'protected-video-modal';
            modal.className = 'protected-modal';

            modal.innerHTML = `
                <div class="protected-inner">
                    <div class="protected-header">
                        <div class="protected-title">${title}</div>
                        <div class="protected-actions">
                            <a class="protected-pdf" href="${pdfUrl || '#'}" target="_blank" rel="noopener">تحميل الملخص</a>
                            <button id="protected-close-btn" class="protected-close">✕</button>
                        </div>
                    </div>

                    <div class="protected-player-wrap">
                        <!-- Invisible overlay to block YouTube native UI clicks -->
                        <div id="protected-overlay" class="protected-overlay" title=""></div>

                        <!-- container where YT.Player iframe will be injected -->
                        <div id="protected-player" class="protected-player"></div>

                        <!-- moving watermark -->
                        <div id="protected-watermark" class="protected-watermark">محتوى محمي - منصة فزيائي</div>
                    </div>

                    <div class="protected-meta">
                        <div class="protected-desc">${description || ''}</div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // close handler
            document.getElementById('protected-close-btn').addEventListener('click', () => {
                window.closeProtectedPlayer();
            });

            // Clicking on background closes if clicked outside content
            modal.addEventListener('click', (e) => {
                if (e.target === modal) window.closeProtectedPlayer();
            });

            // Disable right click inside modal
            modal.addEventListener('contextmenu', (e) => e.preventDefault());

            // Prevent text selection in modal
            modal.onselectstart = () => false;
        }

        // Show modal
        modal.classList.add('active');
        document.body.classList.add('protected-open');

        // Load YouTube IFrame API if not loaded
        if (!window.YT) {
            // Insert script tag once
            if (!document.getElementById('youtube-iframe-api')) {
                const tag = document.createElement('script');
                tag.id = 'youtube-iframe-api';
                tag.src = 'https://www.youtube.com/iframe_api';
                document.head.appendChild(tag);
            }

            // Poll until YT is ready
            const waitForYT = setInterval(() => {
                if (window.YT && window.YT.Player) {
                    clearInterval(waitForYT);
                    createProtectedPlayer(videoId);
                }
            }, 200);
        } else {
            createProtectedPlayer(videoId);
        }

        // start watermark animation
        startProtectedWatermark();

        // Block common keyboard shortcuts that reveal source or copy
        window._protectedKeyHandler = function(e) {
            // Block Ctrl+U, Ctrl+Shift+I/J, Ctrl+Shift+C, Ctrl+C
            if ((e.ctrlKey && e.key === 'u') ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
                (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) ||
                (e.ctrlKey && (e.key === 'c' || e.key === 'C'))
            ) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        };
        document.addEventListener('keydown', window._protectedKeyHandler, true);

    } catch (err) {
        console.error('openProtectedPlayer error', err);
    }
};

// Create or replace YT.Player in protected-player
function createProtectedPlayer(videoId) {
    try {
        // If a previous player exists, destroy it
        if (window._protectedYTPlayer) {
            try { window._protectedYTPlayer.destroy(); } catch(e){}
            window._protectedYTPlayer = null;
        }

        window._protectedYTPlayer = new YT.Player('protected-player', {
            videoId: videoId,
            playerVars: {
                rel: 0, // prevent suggested videos
                modestbranding: 1, // hide youtube logo
                disablekb: 1, // disable keyboard inside iframe
                controls: 1,
                iv_load_policy: 3, // hide annotations
                fs: 1 // allow fullscreen
            },
            events: {
                onReady: function(event) {
                    // Autoplay when ready
                    try { event.target.playVideo(); } catch(e){}
                },
                onStateChange: function(state) {
                    // You can hook analytics here
                }
            }
        });

        // Ensure the overlay captures clicks (so native share/title can't be clicked)
        const overlay = document.getElementById('protected-overlay');
        if (overlay) {
            overlay.style.display = 'block';
            overlay.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
            overlay.onclick = (e) => e.preventDefault();
            overlay.onmousedown = (e) => { if (e.button === 2) { e.preventDefault(); e.stopPropagation(); return false; } };
            overlay.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
            overlay.addEventListener('mousedown', (e) => { if (e.button === 2) { e.preventDefault(); e.stopPropagation(); } }, true);
        }
        
        // Also protect the player container itself
        const playerContainer = document.getElementById('protected-player');
        if (playerContainer) {
            playerContainer.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
            playerContainer.addEventListener('mousedown', (e) => { if (e.button === 2) { e.preventDefault(); e.stopPropagation(); } }, true);
        }

    } catch (e) {
        console.error('createProtectedPlayer error', e);
    }
}

// Close protected player and cleanup
window.closeProtectedPlayer = function() {
    // destroy player
    try { if (window._protectedYTPlayer) window._protectedYTPlayer.destroy(); } catch(e){}
    window._protectedYTPlayer = null;

    // stop watermark
    stopProtectedWatermark();

    const modal = document.getElementById('protected-video-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.classList.remove('protected-open');

    // remove key handler
    if (window._protectedKeyHandler) {
        document.removeEventListener('keydown', window._protectedKeyHandler, true);
        window._protectedKeyHandler = null;
    }
};

// Watermark handling (random movement)
let _protectedWatermarkTimer = null;
function startProtectedWatermark() {
    const wm = document.getElementById('protected-watermark');
    if (!wm) return;
    wm.style.opacity = '0.12';
    moveWatermark();
    _protectedWatermarkTimer = setInterval(moveWatermark, 4000);
}
function stopProtectedWatermark() {
    clearInterval(_protectedWatermarkTimer);
    _protectedWatermarkTimer = null;
    const wm = document.getElementById('protected-watermark');
    if (wm) wm.style.opacity = '0';
}
function moveWatermark() {
    const wm = document.getElementById('protected-watermark');
    if (!wm) return;
    const parent = wm.parentElement;
    const w = parent.clientWidth - wm.clientWidth - 40;
    const h = parent.clientHeight - wm.clientHeight - 40;
    const left = Math.max(10, Math.floor(Math.random() * Math.max(1, w)));
    const top = Math.max(10, Math.floor(Math.random() * Math.max(1, h)));
    wm.style.transform = `translate(${left}px, ${top}px)`;
}


/* ============================================
   Index Page - Centers Management
   ============================================ */

window.loadCentersFromCloudIndex = function() {
    const q = query(collection(db, 'centers'));
    onSnapshot(q, (snapshot) => {
        const centers = [];
        snapshot.forEach(docSnap => centers.push(docSnap.data()));
        localStorage.setItem('centers', JSON.stringify(centers));
        window.renderIndexCenters();
        if (window.updateMapMarkers) window.updateMapMarkers();
    });
};

window.renderIndexCenters = function() {
    const container = document.getElementById('index-centers-list');
    if (!container) return;
    const centers = JSON.parse(localStorage.getItem('centers') || '[]');
    container.innerHTML = '';
    const isTeacher = localStorage.getItem('isTeacher') === 'true';
    if (isTeacher) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn';
        addBtn.textContent = '➕ إضافة مركز جديد';
        addBtn.onclick = () => window.openAddCenterForm();
        container.appendChild(addBtn);
    }
    if (centers.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-cell';
        empty.textContent = 'لا توجد مراكز حالياً';
        container.appendChild(empty);
        return;
    }
    centers.forEach(c => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.innerHTML = `<div style="text-align:right"><strong>${c.name}</strong><div style="color:var(--bg-color)">${c.address || ''}</div></div>`;
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '8px';
        const gotoBtn = document.createElement('a');
        gotoBtn.className = 'btn btn-small';
        gotoBtn.textContent = 'عرض على الخريطة';
        gotoBtn.href = c.link || `https://maps.google.com/?q=${c.lat},${c.lng}`;
        gotoBtn.target = '_blank';
        gotoBtn.rel = 'noopener';
        actions.appendChild(gotoBtn);
        if (isTeacher) {
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-small';
            editBtn.textContent = 'تعديل';
            editBtn.onclick = () => window.editCenterPrompt(c);
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-small btn-danger';
            delBtn.textContent = 'حذف';
            delBtn.onclick = () => window.deleteCenter(c.id);
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
        }
        card.appendChild(actions);
        container.appendChild(card);
    });
};

window.openAddCenterForm = function() {
    const name = prompt('اسم المركز:');
    if (!name) return;
    const address = prompt('العنوان (اختياري):');
    const lat = parseFloat(prompt('خط العرض (latitude):'));
    const lng = parseFloat(prompt('خط الطول (longitude):'));
    if (isNaN(lat) || isNaN(lng)) { alert('إحداثيات غير صالحة'); return; }
    window.addCenter({ name, address, lat, lng });
};

window.addCenter = async function(data) {
    try {
        const id = Date.now().toString();
        const centerData = Object.assign({ id }, data);
        await setDoc(doc(db, 'centers', id), centerData);
    } catch (e) { 
        console.error('خطأ إضافة المركز:', e); 
        alert('حدث خطأ'); 
    }
};

window.editCenterPrompt = function(c) {
    const name = prompt('اسم المركز:', c.name) || c.name;
    const address = prompt('العنوان:', c.address || '') || c.address;
    
    window.updateCenter({ id: c.id, name, address,  });
};

window.updateCenter = async function(data) {
    try {
        const d = Object.assign({}, data);
        const ref = doc(db, 'centers', d.id);
        delete d.id;
        await updateDoc(ref, d);
    } catch (e) { 
        console.error('خطأ تحديث المركز:', e); 
        alert('حدث خطأ في التعديل'); 
    }
};

window.deleteCenter = async function(id) {
    if (!confirm('هل تريد حذف هذا المركز؟')) return;
    try {
        await deleteDoc(doc(db, 'centers', id));
    } catch (e) { 
        console.error('خطأ حذف المركز:', e); 
        alert('حدث خطأ'); 
    }
};

window.initMap = function() {
    window.map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 26.8206, lng: 30.8025 },
        zoom: 6
    });
    window._centerMarkers = {};
    window.updateMapMarkers = function() {
        const centers = JSON.parse(localStorage.getItem('centers') || '[]');
        const ids = centers.map(c => c.id);
        Object.keys(window._centerMarkers).forEach(k => { 
            if (!ids.includes(k)) { 
                window._centerMarkers[k].setMap(null); 
                delete window._centerMarkers[k]; 
            } 
        });
        centers.forEach(c => {
            if (!c.lat || !c.lng) return;
            if (window._centerMarkers[c.id]) return;
            const marker = new google.maps.Marker({ 
                position: { lat: c.lat, lng: c.lng }, 
                map: window.map, 
                title: c.name 
            });
            const info = new google.maps.InfoWindow({ 
                content: `<div><strong>${c.name}</strong><div>${c.address || ''}</div></div>` 
            });
            marker.addListener('click', () => info.open(window.map, marker));
            window._centerMarkers[c.id] = marker;
        });
    };
    window.renderIndexCenters();
    window.updateMapMarkers();
};

// Update meetings every 30 seconds
setInterval(() => { 
    try { 
        window.updateIndexMeetingButtons(); 
    } catch(e){} 
}, 30000);

/* ============================================
   Teacher Dashboard - Exams Management
   ============================================ */

window.loadExamsFromCloud = function() {
    const q = query(collection(db, 'exams'));
    onSnapshot(q, (snapshot) => {
        const exams = [];
        snapshot.forEach((docSnap) => {
            exams.push(docSnap.data());
        });
        localStorage.setItem('exams', JSON.stringify(exams));
        window.renderAllExams && window.renderAllExams();
    });
};

window.uploadExamFirebase = async function() {
    const classNum = document.getElementById('exam-class').value;
    const examName = document.getElementById('exam-name').value.trim();
    const examDesc = document.getElementById('exam-description').value.trim();
    const files = document.getElementById('exam-file').files;
    const messageDiv = document.getElementById('exam-message');
    
    if (!classNum || !examName || files.length === 0) {
        messageDiv.innerHTML = '<span class="message error">❌ اختر الصف واسم الامتحان والصور</span>';
        return;
    }
    
    if (files.length > 4) {
        messageDiv.innerHTML = '<span class="message error">❌ لا تستطيع رفع أكثر من 4 صور</span>';
        return;
    }
    
    messageDiv.innerHTML = '<span class="message info">⏳ جاري رفع الامتحان...</span>';
    
    let imagesData = [];
    let loadedCount = 0;
    
    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            imagesData[index] = e.target.result;
            loadedCount++;
            
            if (loadedCount === files.length) {
                try {
                    const examId = Date.now().toString();
                    const examData = {
                        id: examId,
                        class: parseInt(classNum),
                        name: examName,
                        description: examDesc,
                        images: imagesData,
                        date: new Date().toISOString().split('T')[0],
                        uploadedBy: 'teacher'
                    };
                    
                    await setDoc(doc(db, 'exams', examId), examData);
                    
                    const localExams = JSON.parse(localStorage.getItem('exams') || '[]');
                    localExams.unshift(examData);
                    localStorage.setItem('exams', JSON.stringify(localExams));
                    
                    document.getElementById('exam-class').value = '';
                    document.getElementById('exam-name').value = '';
                    document.getElementById('exam-description').value = '';
                    document.getElementById('exam-file').value = '';
                    messageDiv.innerHTML = '<span class="message success">✅ تم رفع الامتحان بنجاح على السحابة! (' + files.length + ' صورة)</span>';
                    window.renderAllExams();
                    window.loadExamsFromCloud();
                    setTimeout(() => messageDiv.innerHTML = '', 3000);
                } catch (error) {
                    console.error('خطأ في الرفع:', error);
                    messageDiv.innerHTML = '<span class="message error">❌ حدث خطأ: ' + error.message + '</span>';
                }
            }
        };
        reader.readAsDataURL(file);
    });
};

window.renderAllExams = function() {
    const table = document.getElementById('exams-table');
    if (!table) return;
    const exams = JSON.parse(localStorage.getItem('exams') || '[]');
    
    if (exams.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="empty-cell">لا توجد امتحانات</td></tr>';
        return;
    }
    
    table.innerHTML = '';
    const classMap = { '1': 'الصف الأول الثانوي', '2': 'الصف الثاني الثانوي', '3': 'الصف الثالث الثانوي' };
    
    exams.forEach(e => {
        const row = table.insertRow();
        const imagesList = e.images || (e.data ? [e.data] : []);
        let imagesHtml = '';
        if (imagesList.length > 0) {
            imagesHtml = '<div class="images-flex">';
            imagesList.forEach(img => {
                imagesHtml += `<img src="${img}">`;
            });
            imagesHtml += '</div>';
        }
        
        row.innerHTML = `
            <td class="table-center">${imagesHtml}</td>
            <td>${e.name}</td>
            <td>${e.description || '-'}</td>
            <td>${classMap[e.class]}</td>
            <td>${e.date}</td>
            <td>
                <button class="btn btn-danger btn-small" onclick="deleteExam('${e.id}')">🗑️ حذف</button>
            </td>
        `;
    });
};

window.deleteExam = async function(id) {
    if (!confirm('حذف هذا الامتحان؟')) return;
    
    try {
        await deleteDoc(doc(db, 'exams', id));
        
        let exams = JSON.parse(localStorage.getItem('exams') || '[]');
        exams = exams.filter(e => e.id !== id);
        localStorage.setItem('exams', JSON.stringify(exams));
        
        window.renderAllExams();
        window.loadExamsFromCloud();
        alert('✅ تم حذف الامتحان بنجاح');
    } catch (error) {
        console.error('خطأ في الحذف:', error);
        alert('❌ حدث خطأ في حذف الامتحان: ' + error.message);
    }
};

/* ============================================
   Teacher Dashboard - Lessons Management
   ============================================ */

window.loadLessonsFromCloud = function() {
    const q = query(collection(db, 'lessons'));
    onSnapshot(q, (snapshot) => {
        const lessons = [];
        snapshot.forEach((docSnap) => {
            lessons.push(docSnap.data());
        });
        localStorage.setItem('lessons', JSON.stringify(lessons));
    });
};

window.addLessonFirebase = async function() {
    const title = document.getElementById('lessonTitle').value.trim();
    const classNum = document.getElementById('lessonClass').value.trim();
    const description = document.getElementById('lessonDescription').value.trim();
    const link = document.getElementById('lessonLink').value.trim();
    const messageDiv = document.getElementById('lessonMessage');

    if (!title || !classNum || !description) {
        messageDiv.innerHTML = '<span class="message error">❌ يرجى ملء جميع الحقول المطلوبة</span>';
        return;
    }

    try {
        const lessonId = Date.now().toString();
        const today = new Date().toISOString().split('T')[0];
        
        const lessonData = {
            id: lessonId,
            title: title,
            class: classNum,
            description: description,
            link: link,
            date: today
        };

        await setDoc(doc(db, 'lessons', lessonId), lessonData);

        let lessons = JSON.parse(localStorage.getItem('lessons') || '[]');
        lessons.push(lessonData);
        localStorage.setItem('lessons', JSON.stringify(lessons));

        messageDiv.innerHTML = '<span class="message success">✅ تم إضافة الدرس بنجاح!</span>';
        document.getElementById('lessonTitle').value = '';
        document.getElementById('lessonClass').value = '';
        document.getElementById('lessonDescription').value = '';
        document.getElementById('lessonLink').value = '';
        
        window.loadLessonsFromCloud();
        
        setTimeout(() => {
            messageDiv.innerHTML = '';
            location.reload();
        }, 1500);
    } catch (error) {
        messageDiv.innerHTML = '<span class="message error">❌ خطأ: ' + error.message + '</span>';
    }
};

window.addLesson = function() {
    window.addLessonFirebase();
};

/* ============================================
   Teacher Dashboard - Meetings Management
   ============================================ */

window.loadMeetingsFromCloud = function() {
    const q = query(collection(db, 'meetings'));
    onSnapshot(q, (snapshot) => {
        const meetings = [];
        snapshot.forEach((docSnap) => {
            meetings.push(docSnap.data());
        });
        localStorage.setItem('meetings', JSON.stringify(meetings));
        window.renderMeetings && window.renderMeetings();
        window.updateMeetingButtons && window.updateMeetingButtons();
    });
};

window.addMeetingFirebase = async function() {
    const link = document.getElementById('meetingLink').value.trim();
    const classNum = document.getElementById('meetingClassZoom').value;
    const date = document.getElementById('meetingDate').value;
    const time = document.getElementById('meetingTime').value;
    const messageDiv = document.getElementById('meetingMessage');

    if (!link || !classNum || !date || !time) {
        messageDiv.innerHTML = '<span class="message error">❌ يرجى ملء جميع حقول الاجتماع</span>';
        return;
    }

    try {
        const datetimeStr = date + 'T' + time;
        const startTimestamp = new Date(datetimeStr).getTime();
        if (isNaN(startTimestamp)) {
            messageDiv.innerHTML = '<span class="message error">❌ تاريخ/وقت غير صالح</span>';
            return;
        }

        const meetingId = Date.now().toString();
        const meetingData = {
            id: meetingId,
            link: link,
            class: classNum,
            datetime: datetimeStr,
            startTimestamp: startTimestamp,
            createdBy: 'teacher'
        };

        await setDoc(doc(db, 'meetings', meetingId), meetingData);

        let meetings = JSON.parse(localStorage.getItem('meetings') || '[]');
        meetings.unshift(meetingData);
        localStorage.setItem('meetings', JSON.stringify(meetings));

        document.getElementById('meetingLink').value = '';
        document.getElementById('meetingClassZoom').value = '';
        document.getElementById('meetingDate').value = '';
        document.getElementById('meetingTime').value = '';

        messageDiv.innerHTML = '<span class="message success">✅ تم إضافة الاجتماع بنجاح</span>';
        window.renderMeetings();
        window.loadMeetingsFromCloud();
        setTimeout(() => messageDiv.innerHTML = '', 3000);
    } catch (error) {
        console.error('خطأ في إضافة الاجتماع:', error);
        messageDiv.innerHTML = '<span class="message error">❌ خطأ: ' + (error.message || error) + '</span>';
    }
};

window.renderMeetings = function() {
    const table = document.getElementById('meetings-table');
    const meetings = JSON.parse(localStorage.getItem('meetings') || '[]');

    if (!table) return;

    if (meetings.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="empty-cell">لا توجد اجتماعات</td></tr>';
        return;
    }

    table.innerHTML = '';
    const classMap = { '1': 'الصف الأول الثانوي', '2': 'الصف الثاني الثانوي', '3': 'الصف الثالث الثانوي' };

    meetings.forEach(m => {
        const dt = new Date(m.startTimestamp);
        const dateStr = dt.toLocaleDateString('ar-EG');
        const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        const row = table.insertRow();
        row.setAttribute('data-id', m.id);
        row.innerHTML = `
            <td>${classMap[m.class] || m.class}</td>
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td><a href="${m.link}" target="_blank" rel="noopener">رابط الاجتماع</a></td>
            <td>
                <button id="join-${m.id}" class="btn btn-success btn-small" onclick="joinMeeting('${m.link}')" disabled>انضم</button>
                <button class="btn btn-danger btn-small" onclick="deleteMeeting('${m.id}')">حذف</button>
                <div id="join-info-${m.id}" style="font-size:0.85rem;color:var(--text-secondary);margin-top:6px"></div>
            </td>
        `;
    });
};

window.deleteMeeting = async function(id) {
    if (!confirm('هل تريد حذف هذا الاجتماع؟')) return;
    try {
        await deleteDoc(doc(db, 'meetings', id));
        let meetings = JSON.parse(localStorage.getItem('meetings') || '[]');
        meetings = meetings.filter(m => m.id !== id);
        localStorage.setItem('meetings', JSON.stringify(meetings));
        window.renderMeetings();
        window.loadMeetingsFromCloud();
        alert('✅ تم حذف الاجتماع بنجاح');
    } catch (error) {
        console.error('خطأ في حذف الاجتماع:', error);
        alert('❌ حدث خطأ أثناء حذف الاجتماع: ' + (error.message || error));
    }
};

window.updateMeetingButtons = function() {
    const meetings = JSON.parse(localStorage.getItem('meetings') || '[]');
    const now = Date.now();
    meetings.forEach(m => {
        const btn = document.getElementById('join-' + m.id);
        const info = document.getElementById('join-info-' + m.id);
        if (!btn) return;
        const enableAt = (m.startTimestamp || 0) - (5 * 60 * 1000);
        if (now >= enableAt && now <= (m.startTimestamp + (3 * 60 * 60 * 1000))) {
            btn.disabled = false;
            if (info) info.textContent = 'مفتوح الآن';
        } else if (now < enableAt) {
            btn.disabled = true;
            const mins = Math.ceil((enableAt - now) / 60000);
            if (info) info.textContent = `يفتح بعد ${mins} دقيقة`;
        } else {
            btn.disabled = true;
            if (info) info.textContent = 'انتهى الوقت';
        }
    });
};

/* ============================================
   Teacher Dashboard - Centers Management
   ============================================ */

window.parseCoordsFromGoogleLink = function(link) {
    try {
        const m = link.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    } catch (e) {}
    return null;
};

window.addCenterFromDashboard = async function() {
    const name = document.getElementById('centerName').value.trim();
    const link = document.getElementById('centerLink').value.trim();
    const desc = document.getElementById('centerDesc').value.trim();
    const latVal = document.getElementById('centerLat').value.trim();
    const lngVal = document.getElementById('centerLng').value.trim();
    const editId = document.getElementById('editingCenterId').value;
    const msg = document.getElementById('centerMessage');

    if (!name || !link) {
        msg.innerHTML = '<span class="message error">❌ املأ الاسم والرابط</span>';
        return;
    }

    let lat = parseFloat(latVal);
    let lng = parseFloat(lngVal);
    if (isNaN(lat) || isNaN(lng)) {
        const parsed = window.parseCoordsFromGoogleLink(link);
        if (parsed) { lat = parsed.lat; lng = parsed.lng; }
        else { lat = undefined; lng = undefined; }
    }

    try {
        const id = editId || Date.now().toString();
        const data = { id, name, address: desc, link };
        if (typeof lat !== 'undefined' && typeof lng !== 'undefined') { data.lat = lat; data.lng = lng; }

        await setDoc(doc(db, 'centers', id), data);

        msg.innerHTML = '<span class="message success">✅ تم حفظ المركز</span>';
        document.getElementById('centerName').value = '';
        document.getElementById('centerLink').value = '';
        document.getElementById('centerDesc').value = '';
        document.getElementById('centerLat').value = '';
        document.getElementById('centerLng').value = '';
        document.getElementById('editingCenterId').value = '';

        window.loadCentersFromCloud && window.loadCentersFromCloud();
        setTimeout(() => msg.innerHTML = '', 2500);
    } catch (e) {
        console.error('خطأ حفظ المركز:', e);
        msg.innerHTML = '<span class="message error">❌ حدث خطأ</span>';
    }
};

window.renderCentersDashboard = function() {
    const table = document.getElementById('centers-table');
    if (!table) return;
    const centers = JSON.parse(localStorage.getItem('centers') || '[]');
    if (centers.length === 0) {
        table.innerHTML = '<tr><td colspan="4" class="empty-cell">لا توجد مراكز</td></tr>';
        return;
    }
    table.innerHTML = '';
    centers.forEach(c => {
        const row = table.insertRow();
        row.setAttribute('data-id', c.id);
        row.innerHTML = `
            <td>${c.name}</td>
            <td>${c.address || '-'}</td>
            <td><a href="${c.link}" target="_blank">رابط</a></td>
            <td>
                <button class="btn btn-warning btn-small" onclick="editCenterDashboard('${c.id}')">✏️ تعديل</button>
                <button class="btn btn-danger btn-small" onclick="deleteCenterFromDashboard('${c.id}')">🗑️ حذف</button>
            </td>
        `;
    });
};

window.editCenterDashboard = function(id) {
    const centers = JSON.parse(localStorage.getItem('centers') || '[]');
    const c = centers.find(x => x.id === id);
    if (!c) return alert('المركز غير موجود');
    document.getElementById('centerName').value = c.name || '';
    document.getElementById('centerLink').value = c.link || '';
    document.getElementById('centerDesc').value = c.address || '';
    document.getElementById('centerLat').value = c.lat || '';
    document.getElementById('centerLng').value = c.lng || '';
    document.getElementById('editingCenterId').value = c.id;
    window.scrollTo({ top: document.getElementById('centerName').offsetTop - 100, behavior: 'smooth' });
};

window.deleteCenterFromDashboard = async function(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المركز؟')) return;
    try {
        await deleteDoc(doc(db, 'centers', id));
        alert('✅ تم حذف المركز');
    } catch (e) {
        console.error('خطأ حذف المركز:', e);
        alert('❌ حدث خطأ أثناء الحذف');
    }
};

window.loadCentersFromCloud = function() {
    try {
        const q = query(collection(db, 'centers'));
        onSnapshot(q, (snapshot) => {
            const centers = [];
            snapshot.forEach(docSnap => centers.push(docSnap.data()));
            localStorage.setItem('centers', JSON.stringify(centers));
            window.renderCentersDashboard && window.renderCentersDashboard();
        });
    } catch (e) {
        console.error('خطأ تحميل المراكز:', e);
    }
};

// ===== Teacher Dashboard Extra Functions =====

window.logout = function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('isTeacher');
        location.href = 'index.html';
    }
};

// Delete lesson function
window.deleteLesson = async function(button) {
    if (!confirm('هل أنت متأكد من حذف هذا الدرس؟')) return;
    
    const row = button.closest('tr');
    const id = row.getAttribute('data-id');
    
    try {
        await deleteDoc(doc(db, 'lessons', id));
        let lessons = JSON.parse(localStorage.getItem('lessons')) || [];
        lessons = lessons.filter(lesson => lesson.id !== id);
        localStorage.setItem('lessons', JSON.stringify(lessons));
        
        row.remove();
        window.loadLessonsFromCloud();
        alert('✅ تم حذف الدرس بنجاح');
    } catch (error) {
        console.error('خطأ في الحذف:', error);
        alert('❌ حدث خطأ في حذف الدرس: ' + error.message);
    }
};

// Edit lesson function
window.editLesson = function(button) {
    const row = button.closest('tr');
    const cells = row.querySelectorAll('td');
    
    document.getElementById('lessonTitle').value = cells[0].textContent;
    document.getElementById('lessonClass').value = cells[1].textContent.includes('الأول') ? '1' : cells[1].textContent.includes('الثاني') ? '2' : '3';
    document.getElementById('lessonDescription').value = cells[2].textContent;
    
    window.scrollTo({top: document.querySelector('input#lessonTitle').offsetTop - 100, behavior: 'smooth'});
    document.getElementById('lessonTitle').focus();
    
    alert('تم تحميل بيانات الدرس. عدّل ما تريده ثم اضغط "إضافة الدرس" لحفظ التعديلات');
};

// Update dashboard counts
window.updateCounts = function() {
    const lessons = JSON.parse(localStorage.getItem('lessons')) || [];
    const lessonsCountEl = document.getElementById('lessons-count');
    if (lessonsCountEl) lessonsCountEl.textContent = lessons.length;

    let students = JSON.parse(localStorage.getItem('students')) || null;
    const pendingTable = document.getElementById('pending-table');
    const approvedTable = document.getElementById('approved-table');

    if (students) {
        const accepted = students.filter(s => s.status === 'approved').length;
        const pending = students.filter(s => s.status === 'pending').length;
        const acceptedEl = document.getElementById('accepted-count');
        const pendingEl = document.getElementById('pending-count');
        if (acceptedEl) acceptedEl.textContent = accepted;
        if (pendingEl) pendingEl.textContent = pending;
    } else {
        const acceptedEl = document.getElementById('accepted-count');
        const pendingEl = document.getElementById('pending-count');
        const apRows = approvedTable ? approvedTable.querySelectorAll('tr').length : 0;
        const pdRows = pendingTable ? pendingTable.querySelectorAll('tr').length : 0;
        if (acceptedEl) acceptedEl.textContent = apRows;
        if (pendingEl) pendingEl.textContent = pdRows;
    }
};

// Accept / Reject request handlers
window.acceptRequest = function(button) {
    const row = button.closest('tr');
    if (!row) return;
    const cells = row.querySelectorAll('td');
    const student = {
        name: cells[0].textContent.trim(),
        email: cells[1].textContent.trim(),
        date: new Date().toISOString().split('T')[0],
        status: 'approved'
    };

    let students = JSON.parse(localStorage.getItem('students')) || [];
    students.push(student);
    localStorage.setItem('students', JSON.stringify(students));

    const approvedTable = document.getElementById('approved-table');
    const newRow = approvedTable.insertRow();
    newRow.innerHTML = `
        <td>${student.name}</td>
        <td>${student.email}</td>
        <td>${student.date}</td>
        <td><span class="status-badge">نشط</span></td>
        <td>
            <button class="btn btn-warning btn-small" onclick="editStudent(this)">✏️ تعديل</button>
            <button class="btn btn-danger btn-small" onclick="removeApproved(this)">🗑️ حذف</button>
        </td>
    `;

    row.remove();
    window.updateCounts();
};

window.rejectRequest = function(button) {
    const row = button.closest('tr');
    if (!row) return;
    if (!confirm('هل أنت متأكد من رفض طلب الانضمام؟')) return;
    row.remove();
    window.updateCounts();
};

window.removeApproved = function(button) {
    const row = button.closest('tr');
    if (!row) return;
    const email = row.querySelectorAll('td')[1].textContent.trim();
    let students = JSON.parse(localStorage.getItem('students')) || [];
    students = students.filter(s => s.email !== email || s.status !== 'approved');
    localStorage.setItem('students', JSON.stringify(students));
    row.remove();
    window.updateCounts();
};

window.editStudent = function(button) {
    alert('فتح محرر بيانات الطالب (ليس مفعّل حالياً)');
};

// Initialize page on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // Load lessons into table
    const table = document.getElementById('lessons-table');
    if (table) {
        let lessons = JSON.parse(localStorage.getItem('lessons')) || [];
        
        const rows = table.querySelectorAll('tr');
        if (lessons.length > 0 && rows.length === 1) {
            rows[0].remove();
        }
        
        lessons.forEach(lesson => {
            const classMap = {
                '1': 'الصف الأول الثانوي',
                '2': 'الصف الثاني الثانوي',
                '3': 'الصف الثالث الثانوي'
            };
            
            const newRow = table.insertRow();
            newRow.setAttribute('data-id', lesson.id);
            newRow.innerHTML = `
                <td>${lesson.title}</td>
                <td>${classMap[lesson.class]}</td>
                <td>${lesson.description}</td>
                <td>${lesson.date}</td>
                <td>
                    <button class="btn btn-warning btn-small" onclick="editLesson(this)">✏️ تعديل</button>
                    <button class="btn btn-danger btn-small" onclick="deleteLesson(this)">🗑️ حذف</button>
                </td>
            `;
        });
    }

    // Migrate students data from tables to localStorage if needed
    if (localStorage.getItem('students') === null) {
        const migrated = [];
        const pdTable = document.getElementById('pending-table');
        const apTable = document.getElementById('approved-table');

        if (pdTable) {
            const rows = pdTable.querySelectorAll('tr');
            rows.forEach(r => {
                const cells = r.querySelectorAll('td');
                if (cells.length >= 3) {
                    migrated.push({
                        name: cells[0].textContent.trim(),
                        email: cells[1].textContent.trim(),
                        date: cells[2].textContent.trim() || new Date().toISOString().split('T')[0],
                        status: 'pending'
                    });
                }
            });
        }

        if (apTable) {
            const rows = apTable.querySelectorAll('tr');
            rows.forEach(r => {
                const cells = r.querySelectorAll('td');
                if (cells.length >= 3) {
                    migrated.push({
                        name: cells[0].textContent.trim(),
                        email: cells[1].textContent.trim(),
                        date: cells[2].textContent.trim() || new Date().toISOString().split('T')[0],
                        status: 'approved'
                    });
                }
            });
        }

        if (migrated.length > 0) {
            localStorage.setItem('students', JSON.stringify(migrated));
        }
    }

    // Load students into tables
    const students = JSON.parse(localStorage.getItem('students')) || null;
    if (students) {
        const pendingTable = document.getElementById('pending-table');
        const approvedTable = document.getElementById('approved-table');
        
        if (pendingTable) pendingTable.innerHTML = '';
        if (approvedTable) approvedTable.innerHTML = '';

        students.forEach(s => {
            if (s.status === 'pending' && pendingTable) {
                const r = pendingTable.insertRow();
                r.innerHTML = `
                    <td>${s.name}</td>
                    <td>${s.email}</td>
                    <td>${s.date || ''}</td>
                    <td>
                        <button class="btn btn-success btn-small" onclick="acceptRequest(this)">✅ قبول</button>
                        <button class="btn btn-danger btn-small" onclick="rejectRequest(this)">❌ رفض</button>
                    </td>
                `;
            } else if (s.status === 'approved' && approvedTable) {
                const r = approvedTable.insertRow();
                r.innerHTML = `
                    <td>${s.name}</td>
                    <td>${s.email}</td>
                    <td>${s.date || ''}</td>
                    <td><span class="status-badge">نشط</span></td>
                    <td>
                        <button class="btn btn-warning btn-small" onclick="editStudent(this)">✏️ تعديل</button>
                        <button class="btn btn-danger btn-small" onclick="removeApproved(this)">🗑️ حذف</button>
                    </td>
                `;
            }
        });
    }

    // Update counts and render
    window.updateCounts && window.updateCounts();
    window.renderAllExams && window.renderAllExams();
    
    // Load cloud data
    setTimeout(() => {
        window.loadExamsFromCloud && window.loadExamsFromCloud();
        window.loadLessonsFromCloud && window.loadLessonsFromCloud();
        if (typeof window.loadMeetingsFromCloud === 'function') window.loadMeetingsFromCloud();
        if (typeof window.loadCentersFromCloud === 'function') window.loadCentersFromCloud();
        if (typeof window.loadTeacherVideoLessons === 'function') window.loadTeacherVideoLessons();
    }, 1000);
});

// ===== Display functions for exams and lessons =====

// Student Pages: Exams and Lessons
document.addEventListener('DOMContentLoaded', function() {
    const path = location.pathname;
    const isExamPage = path.includes('e1') || path.includes('e2') || path.includes('e3');
    const isClassPage = path.includes('class-1') || path.includes('class-2') || path.includes('class-3');
    
    console.log('Student pages check - isExamPage:', isExamPage, 'isClassPage:', isClassPage);
    
    if (isExamPage) {
        // Load exams for student pages
        const examsQ = query(collection(db, 'exams'));
        onSnapshot(examsQ, (snapshot) => {
            const exams = [];
            snapshot.forEach((doc) => exams.push(doc.data()));
            console.log('✅ Exams loaded from Firebase:', exams);
            localStorage.setItem('exams', JSON.stringify(exams));
            window.renderExams && window.renderExams();
        });
    }
    
    if (isClassPage) {
        // Load lessons for student pages
        const lessonsQ = query(collection(db, 'lessons'));
        onSnapshot(lessonsQ, (snapshot) => {
            const lessons = [];
            snapshot.forEach((doc) => lessons.push(doc.data()));
            console.log('✅ Lessons loaded from Firebase:', lessons);
            localStorage.setItem('lessons', JSON.stringify(lessons));
            
            let classNum = '1';
            if (path.includes('class-2')) classNum = '2';
            if (path.includes('class-3')) classNum = '3';
            
            window.loadLessons && window.loadLessons(classNum);
            
            // Load videos for this class
            window.loadClassVideos && window.loadClassVideos(classNum);
        });
    }
});

// ===== Display functions for exams and lessons =====

// Render exams on exam pages (e1, e2, e3)
window.renderExams = function() {
    const container = document.getElementById('exams-container');
    if (!container) {
        console.error('لم يتم العثور على exams-container');
        return;
    }
    
    const examsData = localStorage.getItem('exams');
    console.log('localStorage exams:', examsData);
    
    const exams = examsData ? JSON.parse(examsData) : [];
    console.log('Parsed exams:', exams);
    
    // Determine which class this exam page is for
    const path = location.pathname;
    let classNum = '1';
    if (path.includes('e2')) classNum = '2';
    if (path.includes('e3')) classNum = '3';
    
    console.log('Current page class:', classNum);
    
    // Filter exams for this class
    const classExams = exams.filter(e => {
        console.log('Filtering exam:', e, 'class:', e.class, 'target:', parseInt(classNum));
        return e.class === parseInt(classNum);
    });
    
    console.log('Filtered exams for class ' + classNum + ':', classExams);
    
    if (classExams.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px;"><p class="empty-state">لا توجد امتحانات متاحة حالياً</p></div>';
        return;
    }
    
    // Initialize gallery storage
    if (!window.examGalleries) {
        window.examGalleries = {};
    }
    
    container.innerHTML = '';
    classExams.forEach((exam, examIndex) => {
        const examCard = document.createElement('div');
        examCard.className = 'exam-card';
        
        const imagesHtml = (exam.images || []).length > 0
            ? `<div class="exam-card-images">
                ${(exam.images || []).map((img, imgIndex) => `
                    <img src="${img}" alt="${exam.name}" onerror="this.style.display='none'" style="width: 100%; height: auto; display: block;">
                `).join('')}
              </div>`
            : '';
        
        // Create unique gallery ID for this exam
        const galleryId = 'exam_' + Date.now() + '_' + examIndex;
        window.examGalleries[galleryId] = exam.images || [];
        
        // Create buttons HTML for download and view
        const buttonsHtml = (exam.images || []).length > 0
            ? `<div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
                <button onclick="downloadAllImages('${galleryId}', '${(exam.name || 'exam').replace(/'/g, "\\'")}')" class="btn" style="padding: 8px 12px; font-size: 13px; background: #0b5ed7; color: white; border: none; border-radius: 4px; cursor: pointer; flex: 1; min-width: 100px;">⬇️ تنزيل الكل</button>
                ${(exam.images || []).length > 0 ? `<button onclick="displayImageGallery('${galleryId}', 0)" class="btn" style="padding: 8px 12px; font-size: 13px; background: #0ea5a4; color: white; border: none; border-radius: 4px; cursor: pointer; flex: 1; min-width: 100px;">👁️ عرض الصور</button>` : ''}
              </div>`
            : '';
        
        examCard.innerHTML = `
            ${imagesHtml}
            <div class="exam-card-info">
                <h3 class="exam-card-title">${exam.name || 'بدون اسم'}</h3>
                <p class="exam-card-desc">${exam.description || 'بدون وصف'}</p>
                <p class="exam-card-date">📅 ${exam.date || 'بدون تاريخ'}</p>
                ${buttonsHtml}
            </div>
        `;
        container.appendChild(examCard);
    });
    
    console.log('تم عرض', classExams.length, 'امتحان');
};

// Load lessons for specific class
window.loadLessons = function(classNum) {
    const container = document.getElementById('lessons-container');
    if (!container) {
        console.error('لم يتم العثور على lessons-container');
        return;
    }
    
    console.log('Loading lessons for class:', classNum);
    
    const lessonsData = localStorage.getItem('lessons');
    console.log('localStorage lessons:', lessonsData);
    
    const lessons = lessonsData ? JSON.parse(lessonsData) : [];
    console.log('Parsed lessons:', lessons);
    
    // Filter lessons for this class
    const classLessons = lessons.filter(l => {
        console.log('Filtering lesson:', l, 'class:', l.class, 'target:', classNum);
        return l.class === classNum;
    });
    
    console.log('Filtered lessons for class ' + classNum + ':', classLessons);
    
    if (classLessons.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px;"><p class="empty-state">لا توجد دروس متاحة حالياً</p></div>';
        return;
    }
    
    container.innerHTML = '';
    classLessons.forEach((lesson, lessonIndex) => {
        const lessonCard = document.createElement('div');
        lessonCard.className = 'exam-card';
        lessonCard.style.maxWidth = '300px';
        lessonCard.style.cursor = lesson.link ? 'pointer' : 'default';
        
        let videoHtml = '';
        let videoId = null;
        
        if (lesson.link) {
            // Extract YouTube video ID if it's a YouTube link
            const youtubeMatch = lesson.link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
            if (youtubeMatch) {
                videoId = youtubeMatch[1];
            }

            if (videoId) {
                // Show YouTube thumbnail as the card image
                const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                videoHtml = `
                    <div style="position: relative; width: 100%; overflow: hidden; border-radius: 8px; margin-bottom: 15px; background: #000;">
                        <img src="${thumbnailUrl}" alt="${lesson.title}" style="width: 100%; height: auto; display: block; object-fit: cover;">
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 50px; opacity: 0.8;">▶️</div>
                    </div>
                `;
            }
        }
        
        lessonCard.innerHTML = `
            ${videoHtml}
            <div class="exam-card-info">
                <h3 class="exam-card-title">${lesson.title || 'بدون عنوان'}</h3>
                <p class="exam-card-desc">${lesson.description || 'بدون وصف'}</p>
            </div>
        `;
        
        // Add click event to open video in modal
        if (videoId) {
            lessonCard.onclick = () => window.openVideoModal(videoId, lesson.title || 'فيديو');
            lessonCard.style.transition = 'transform 0.2s, box-shadow 0.2s';
            lessonCard.onmouseover = () => {
                lessonCard.style.transform = 'scale(1.05)';
                lessonCard.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
            };
            lessonCard.onmouseout = () => {
                lessonCard.style.transform = 'scale(1)';
                lessonCard.style.boxShadow = '';
            };
        } else if (lesson.link) {
            lessonCard.onclick = () => window.open(lesson.link, '_blank');
        }
        
        container.appendChild(lessonCard);
    });
    
    console.log('تم عرض', classLessons.length, 'درس');
};

// ===== Image Download and Display Functions =====

window.downloadImage = function(imageUrl, fileName) {
    try {
        // Create a temporary link element
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = fileName + '.png';
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('Image downloaded:', fileName);
    } catch (error) {
        console.error('Download error:', error);
        alert('❌ حدث خطأ في تنزيل الصورة');
    }
};

window.displayImageFullscreen = function(imageUrl) {
    try {
        // Create modal for fullscreen display
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            direction: rtl;
        `;
        
        const imgContainer = document.createElement('div');
        imgContainer.style.cssText = `
            position: relative;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        `;
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.cssText = `
            max-width: 100%;
            max-height: 80vh;
            border-radius: 8px;
        `;
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '❌ إغلاق';
        closeBtn.style.cssText = `
            margin-top: 20px;
            padding: 10px 20px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
        `;
        closeBtn.onclick = function() {
            document.body.removeChild(modal);
        };
        
        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.innerText = '⬇️ تنزيل';
        downloadBtn.style.cssText = `
            margin-top: 10px;
            margin-right: 10px;
            padding: 10px 20px;
            background: #0b5ed7;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
        `;
        downloadBtn.onclick = function() {
            window.downloadImage(imageUrl, 'exam_image');
        };
        
        imgContainer.appendChild(img);
        imgContainer.appendChild(downloadBtn);
        imgContainer.appendChild(closeBtn);
        
        modal.appendChild(imgContainer);
        document.body.appendChild(modal);
        
        // Close on Escape key
        const escapeHandler = function(e) {
            if (e.key === 'Escape') {
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        console.log('Image displayed in fullscreen');
    } catch (error) {
        console.error('Display error:', error);
        alert('❌ حدث خطأ في عرض الصورة');
    }
};

// Download all images at once
window.downloadAllImages = function(galleryId, examName) {
    try {
        const images = window.examGalleries && window.examGalleries[galleryId];
        if (!images || images.length === 0) {
            alert('❌ لا توجد صور لتنزيلها');
            return;
        }
        
        images.forEach((img, index) => {
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = img;
                link.download = examName + '_' + (index + 1) + '.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                console.log('Downloaded image:', index + 1);
            }, index * 500); // Delay each download by 500ms to avoid browser blocking
        });
        
        console.log('Started downloading', images.length, 'images');
    } catch (error) {
        console.error('Download all error:', error);
        alert('❌ حدث خطأ في تنزيل الصور');
    }
};

// Image Gallery with arrow navigation
window.displayImageGallery = function(galleryId, startIndex) {
    try {
        // Get images from gallery storage
        const images = window.examGalleries && window.examGalleries[galleryId] 
            ? window.examGalleries[galleryId] 
            : [];
        
        if (!images || images.length === 0) {
            alert('❌ لا توجد صور لعرضها');
            return;
        }
        
        let currentIndex = startIndex || 0;
        
        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            direction: rtl;
        `;
        
        const galleryContainer = document.createElement('div');
        galleryContainer.style.cssText = `
            position: relative;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: center;
            gap: 20px;
        `;
        
        // Main image wrapper
        const imgWrapper = document.createElement('div');
        imgWrapper.style.cssText = `
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            flex: 1;
        `;
        
        // Main image
        const mainImg = document.createElement('img');
        mainImg.style.cssText = `
            max-width: 100%;
            max-height: 70vh;
            border-radius: 8px;
            object-fit: contain;
        `;
        
        // Close button - top right corner on image
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            width: 40px;
            height: 40px;
            background: rgba(220, 53, 69, 0.9);
            color: white;
            border: none;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 0;
            line-height: 1;
        `;
        
        // Image counter
        const counter = document.createElement('div');
        counter.style.cssText = `
            margin-top: 15px;
            font-size: 18px;
            color: white;
            text-align: center;
        `;
        
        // Navigation arrows - fixed at screen edges
        const prevBtn = document.createElement('button');
        prevBtn.innerText = '◀';
        prevBtn.style.cssText = `
            position: fixed;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            width: 64px;
            height: 64px;
            padding: 0;
            font-size: 26px;
            background: rgba(11, 94, 215, 0.95);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            box-shadow: 0 8px 20px rgba(0,0,0,0.35);
        `;

        const nextBtn = document.createElement('button');
        nextBtn.innerText = '▶';
        nextBtn.style.cssText = `
            position: fixed;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            width: 64px;
            height: 64px;
            padding: 0;
            font-size: 26px;
            background: rgba(14, 165, 164, 0.95);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            box-shadow: 0 8px 20px rgba(0,0,0,0.35);
        `;
        
        // Update function
        const updateImage = function() {
            mainImg.src = images[currentIndex];
            counter.innerText = `الصورة ${currentIndex + 1} من ${images.length}`;
            
            // Update button states
            prevBtn.style.opacity = currentIndex === 0 ? '0.5' : '1';
            prevBtn.style.pointerEvents = currentIndex === 0 ? 'none' : 'auto';
            
            nextBtn.style.opacity = currentIndex === images.length - 1 ? '0.5' : '1';
            nextBtn.style.pointerEvents = currentIndex === images.length - 1 ? 'none' : 'auto';
        };
        
        // Event listeners for navigation
        prevBtn.onclick = function() {
            if (currentIndex > 0) {
                currentIndex--;
                updateImage();
            }
        };

        nextBtn.onclick = function() {
            if (currentIndex < images.length - 1) {
                currentIndex++;
                updateImage();
            }
        };
        
        // Close button
        closeBtn.onclick = function() {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', keyHandler);
            }
        };
        
        // Keyboard navigation (ArrowLeft = previous, ArrowRight = next)
        const keyHandler = function(e) {
            if (e.key === 'ArrowLeft') {
                if (currentIndex > 0) {
                    currentIndex--;
                    updateImage();
                }
            } else if (e.key === 'ArrowRight') {
                if (currentIndex < images.length - 1) {
                    currentIndex++;
                    updateImage();
                }
            } else if (e.key === 'Escape') {
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', keyHandler);
                }
            }
        };
        
        // Close button click handler
        closeBtn.onclick = function() {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', keyHandler);
            }
        };
        
        // Append elements - arrows are fixed at screen edges, image fills remaining area
        imgWrapper.appendChild(mainImg);
        imgWrapper.appendChild(closeBtn);
        imgWrapper.appendChild(counter);

        galleryContainer.appendChild(imgWrapper);
        modal.appendChild(galleryContainer);
        // add arrows to modal so they sit at screen edges
        modal.appendChild(prevBtn);
        modal.appendChild(nextBtn);
        document.body.appendChild(modal);
        
        // Initialize
        updateImage();
        document.addEventListener('keydown', keyHandler);
        
        console.log('Image gallery displayed with', images.length, 'images');
    } catch (error) {
        console.error('Gallery display error:', error);
        alert('❌ حدث خطأ في عرض معرض الصور');
    }
};

// ============================================
// Video Lesson Management Functions
// إدارة دروس الفيديو
// ============================================

// Helper: Extract YouTube Video ID from URL
function extractYouTubeVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Helper: Get current user
async function getCurrentUser() {
    return new Promise((resolve) => {
        auth.onAuthStateChanged((user) => {
            resolve(user);
        });
    });
}

// ============================================
// Publish Video Lesson to Firebase
// نشر درس فيديو إلى Firebase
// ============================================
window.publishVideoLesson = async function() {
    const titleInput = document.getElementById('video-title');
    const classInput = document.getElementById('video-class');
    const descInput = document.getElementById('video-description');
    const urlInput = document.getElementById('youtube-link');
    const publishBtn = document.querySelector('.btn-publish') || document.querySelector('#video-form button[type="submit"]');
    const publishBtnText = document.getElementById('publish-btn-text');
    const videoMessage = document.getElementById('video-message');

    try {
        // Validate inputs
        if (!titleInput.value.trim() || !descInput.value.trim() || !urlInput.value.trim() || (classInput && !classInput.value)) {
            if (videoMessage) videoMessage.innerText = '❌ الرجاء ملء جميع الحقول';
            else alert('❌ الرجاء ملء جميع الحقول');
            return;
        }

        // Extract video ID
        const videoId = extractYouTubeVideoId(urlInput.value);
        if (!videoId) {
            if (videoMessage) videoMessage.innerText = '❌ رابط اليوتيوب غير صحيح';
            else alert('❌ رابط اليوتيوب غير صحيح');
            return;
        }

        // Get user (optional - allow guest publishing)
        let user = auth.currentUser || null;
        if (!user) {
            try {
                user = await getCurrentUser();
            } catch (e) {
                user = null;
            }
        }

        // Allow publishing even without user logged in (guest user)

        // Show loading state
        if (publishBtn) publishBtn.disabled = true;
        if (publishBtnText) publishBtnText.textContent = 'جاري النشر...';
        if (videoMessage) videoMessage.innerText = 'جاري النشر...';

        // Check if we're editing or creating
        const isEditing = window.editingVideoId ? true : false;
        const docId = isEditing ? window.editingVideoId : Date.now().toString();

        // Prepare video data
        const videoData = {
            id: docId,
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
            youtubeId: videoId,
            youtubeUrl: urlInput.value,
            teacherId: user ? user.uid : 'guest',
            createdAt: new Date(),
            timestamp: Date.now()
        };

        // Add classLevel if available
        if (classInput && classInput.value) {
            videoData.classLevel = classInput.value;
        }

        // Save to Firebase
        await setDoc(doc(db, 'videoLessons', docId), videoData);

        if (videoMessage) videoMessage.innerText = isEditing ? '✅ تم تحديث الدرس بنجاح!' : '✅ تم نشر الدرس بنجاح!';
        else alert(isEditing ? '✅ تم تحديث الدرس بنجاح!' : '✅ تم نشر الدرس بنجاح!');

        // Reset form
        document.getElementById('video-form').reset();
        window.editingVideoId = null;
        
        if (publishBtn) publishBtn.disabled = false;
        if (publishBtnText) publishBtnText.textContent = '🚀 نشر درس الفيديو';

        // Reload videos in all views
        window.loadVideoLessons && window.loadVideoLessons();
        window.loadTeacherVideos && window.loadTeacherVideos();
        window.loadVideosManagementTable && window.loadVideosManagementTable();
        
        // Refresh class videos
        const classNum = classInput && classInput.value ? classInput.value : null;
        if (classNum && window.loadClassVideos) window.loadClassVideos(classNum);

    } catch (error) {
        console.error('Error publishing video:', error);
        const errorMsg = '❌ حدث خطأ في النشر: ' + error.message;
        if (videoMessage) videoMessage.innerText = errorMsg;
        else alert(errorMsg);
        if (publishBtn) publishBtn.disabled = false;
        if (publishBtnText) publishBtnText.textContent = '🚀 نشر درس الفيديو';
    }
};

// ============================================
// Load Teacher's Videos (for gallery view)
// جلب فيديوهات المعلم
// ============================================
window.loadTeacherVideos = async function() {
    try {
        console.log('📹 loadTeacherVideos called');
        const videosGrid = document.getElementById('teacher-videos-grid');
        
        if (!videosGrid) {
            console.warn('❌ teacher-videos-grid not found');
            return;
        }
        
        const user = await getCurrentUser();
        console.log('👤 Current user:', user?.uid || 'null');
        if (!user) {
            console.log('❌ No user logged in');
            return;
        }
        
        const q = query(
            collection(db, 'videoLessons'),
            where('teacherId', '==', user.uid)
        );
        
        onSnapshot(q, (snapshot) => {
            const videos = [];
            snapshot.forEach((doc) => {
                videos.push({ id: doc.id, ...doc.data() });
            });

            videos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            console.log('📊 Teacher videos:', videos.length);

            if (videos.length === 0) {
                videosGrid.innerHTML = '';
            } else {
                videosGrid.innerHTML = videos.map(video => `
                    <div class="video-card">
                        <div class="video-thumbnail" style="background-image:url('https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg')"></div>
                        <div class="video-info">
                            <h3 class="video-title">${video.title}</h3>
                            <p class="video-description">${video.description}</p>
                            <div class="video-actions">
                                <button class="btn-view" onclick="window.openProtectedPlayer('${video.youtubeId}', '${video.title.replace(/'/g, "\\'")}', '${(video.description||'').replace(/'/g, "\\'")}','')">
                                    ▶ مشاهدة
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            console.log('✅ Teacher videos rendered');
        });

    } catch (error) {
        console.error('Error loading teacher videos:', error);
    }
};

// ============================================
// Delete Video Lesson
// حذف درس فيديو
// ============================================
window.deleteVideoLesson = async function(videoId) {
    if (!confirm('هل أنت متأكد من حذف هذا الدرس؟')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'videoLessons', videoId));
        alert('✅ تم حذف الدرس بنجاح');
        
        // Refresh all views
        window.loadVideoLessons && window.loadVideoLessons();
        window.loadTeacherVideos && window.loadTeacherVideos();
        window.loadVideosManagementTable && window.loadVideosManagementTable();
        
        // Refresh all class videos
        window.loadClassVideos && window.loadClassVideos(1);
        window.loadClassVideos && window.loadClassVideos(2);
        window.loadClassVideos && window.loadClassVideos(3);
    } catch (error) {
        console.error('Error deleting video:', error);
        alert('❌ حدث خطأ في حذف الدرس');
    }
};

// ============================================
// Load Video Lessons from Firebase
// جلب دروس الفيديو من Firebase
// ============================================
window.loadVideoLessons = async function() {
    try {
        const videosGrid = document.getElementById('videos-grid');
        const emptyState = document.getElementById('empty-state');
        
        if (!videosGrid) return; // Page doesn't have videos-grid
        
        videosGrid.innerHTML = '';
        
        const q = query(collection(db, 'videoLessons'));
        
        onSnapshot(q, (snapshot) => {
            const videos = [];
            snapshot.forEach((doc) => {
                videos.push({ id: doc.id, ...doc.data() });
            });

            // Sort by most recent first
            videos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            if (videos.length === 0) {
                videosGrid.innerHTML = '';
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                videosGrid.innerHTML = videos.map(video => `
                    <div class="video-card">
                        <div class="video-thumbnail"></div>
                        <div class="video-info">
                            <h3 class="video-title">${video.title}</h3>
                            <p class="video-description">${video.description}</p>
                            <div class="video-actions">
                                <button class="btn-view" onclick="window.openProtectedPlayer('${video.youtubeId}', '${video.title.replace(/'/g, "\\'")}', '${(video.description||'').replace(/'/g, "\\'")}','')">
                                    ▶ مشاهدة
                                </button>
                                ${isTeacherVideo(video.teacherId) ? `
                                    <button class="btn-delete" onclick="window.deleteVideoLesson('${video.id}')">
                                        🗑 حذف
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            console.log('✅ Videos loaded:', videos.length);
        });

    } catch (error) {
        console.error('Error loading videos:', error);
    }
};

// ============================================
// Load Teacher's Video Lessons for Teacher Dashboard
// جلب دروس الفيديو الخاصة بالمعلم لأغراض الإدارة
// ============================================
window.loadTeacherVideoLessons = async function() {
    try {
        const user = await getCurrentUser();
        if (!user) return; // Not logged in

        const teacherVideosGrid = document.getElementById('teacher-videos-grid');
        const emptyTeacherVideos = document.getElementById('teacher-empty-videos');
        
        if (!teacherVideosGrid) return; // Not on teacher page

        const q = query(collection(db, 'videoLessons'), where('teacherId', '==', user.uid));
        
        onSnapshot(q, (snapshot) => {
            const videos = [];
            snapshot.forEach((doc) => {
                videos.push({ id: doc.id, ...doc.data() });
            });

            // Sort by most recent first
            videos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            if (videos.length === 0) {
                teacherVideosGrid.innerHTML = '';
                emptyTeacherVideos.style.display = 'block';
            } else {
                emptyTeacherVideos.style.display = 'none';
                teacherVideosGrid.innerHTML = videos.map(video => `
                    <div class="video-card">
                        <div class="video-thumbnail" style="background-image:url('https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg')"></div>
                        <div class="video-info">
                            <h3 class="video-title">${video.title}</h3>
                            <p class="video-description">${video.description}</p>
                            <div class="video-actions">
                                <button class="btn-view" onclick="window.playVideo('${video.id}', '${video.title.replace(/'/g, "\\'")}', '${video.youtubeId}')">
                                    ▶ معاينة
                                </button>
                                <button class="btn-delete" onclick="window.deleteVideoLesson('${video.id}')">
                                    🗑 حذف
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            console.log('✅ Teacher videos loaded:', videos.length);
        });

    } catch (error) {
        console.error('Error loading teacher videos:', error);
    }
};

// ============================================
// ============================================
// Play Video in Modal with Protection
// تشغيل الفيديو مع الحماية
// ============================================
window.playVideo = function(videoId, title, youtubeId) {
    try {
        // Create fullscreen video modal
        let modal = document.getElementById('fullscreen-video-modal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'fullscreen-video-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #000;
                z-index: 99999;
                display: none;
                align-items: center;
                justify-content: center;
                direction: rtl;
            `;
            
            modal.innerHTML = `
                <div style="
                    position: relative;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                ">
                    <!-- Close Button -->
                    <button id="close-video-btn" style="
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        width: 50px;
                        height: 50px;
                        background: rgba(220, 53, 69, 0.9);
                        color: white;
                        border: none;
                        border-radius: 50%;
                        font-size: 28px;
                        cursor: pointer;
                        z-index: 100000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='rgba(220, 53, 69, 1)'" onmouseout="this.style.background='rgba(220, 53, 69, 0.9)'">
                        ✕
                    </button>
                    
                    <!-- Video Container -->
                    <div id="fullscreen-video-container" style="
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    "></div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Close button event listener
            document.getElementById('close-video-btn').addEventListener('click', window.closeFullscreenVideo);
        }
        
        // Set video content
        const videoContainer = document.getElementById('fullscreen-video-container');
        
        // Create iframe WITHOUT recommendation options and modestbranding
        const iframeHTML = `
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 50001; pointer-events: auto; border-radius: 8px;" id="fullscreen-video-overlay"></div>
            <iframe 
                src="https://www.youtube.com/embed/${youtubeId}?rel=0&controls=1&autoplay=1&fs=1&modestbranding=0" 
                style="
                    width: 100%;
                    height: 100%;
                    border: none;
                "
                allow="autoplay; encrypted-media; fullscreen"
                allowfullscreen>
            </iframe>
        `;
        
        videoContainer.innerHTML = iframeHTML;
        
        // Protect the overlay from right-click
        setTimeout(() => {
            const overlay = document.getElementById('fullscreen-video-overlay');
            if (overlay) {
                overlay.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); return false; }, true);
                overlay.addEventListener('mousedown', (e) => { if (e.button === 2) { e.preventDefault(); e.stopPropagation(); } }, true);
            }
        }, 100);
        
        // Show modal
        modal.style.display = 'flex';
        
        // Prevent scroll
        document.body.style.overflow = 'hidden';
        
        console.log('Video playing fullscreen:', title);

    } catch (error) {
        console.error('Error playing video:', error);
        alert('❌ حدث خطأ في تشغيل الفيديو');
    }
};

// ============================================
// Close Fullscreen Video
// إغلاق الفيديو
// ============================================
window.closeFullscreenVideo = function() {
    const modal = document.getElementById('fullscreen-video-modal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('fullscreen-video-container').innerHTML = '';
        document.body.style.overflow = 'auto';
    }
};

// Close fullscreen video when clicking outside (on black background)
document.addEventListener('click', (e) => {
    const fullscreenModal = document.getElementById('fullscreen-video-modal');
    if (fullscreenModal && fullscreenModal.style.display === 'flex') {
        // Only close if clicking directly on the modal background, not on the video
        if (e.target === fullscreenModal) {
            window.closeFullscreenVideo();
        }
    }
});

// ============================================
// Initialize Watermark Animation
// تهيئة العلامة المائية
// ============================================
function initializeWatermark() {
    const watermark = document.getElementById('floating-watermark');
    if (!watermark) return;

    // Position watermark randomly
    const positions = [
        { top: '20%', left: '10%' },
        { top: '30%', left: '70%' },
        { top: '60%', left: '15%' },
        { top: '50%', left: '65%' },
        { top: '75%', left: '20%' }
    ];

    const randomPos = positions[Math.floor(Math.random() * positions.length)];
    watermark.style.top = randomPos.top;
    watermark.style.left = randomPos.left;

    // Restart animation
    watermark.style.animation = 'none';
    setTimeout(() => {
        watermark.style.animation = 'float-watermark 6s infinite ease-in-out';
    }, 10);
}

// ============================================
// Close Video Player
// إغلاق مشغل الفيديو
// ============================================
window.closeVideoPlayer = function() {
    const modal = document.getElementById('video-player-modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.getElementById('video-content').innerHTML = '';
};

// ============================================
// Check if current user is teacher of this video
// التحقق من كون المستخدم معلم الفيديو
// ============================================
async function isTeacherVideo(teacherId) {
    const user = await getCurrentUser();
    return user && user.uid === teacherId;
}

// ============================================
// Load Videos Management Table for Teacher Dashboard
// تحميل جدول إدارة الفيديوهات
// ============================================
window.loadVideosManagementTable = async function() {
    try {
        console.log('📋 loadVideosManagementTable called');
        const managementTable = document.getElementById('videos-management-table');
        
        if (!managementTable) {
            console.warn('❌ videos-management-table not found');
            return;
        }
        
        const user = await getCurrentUser();
        if (!user) {
            console.log('❌ No user logged in');
            return;
        }
        
        const q = query(
            collection(db, 'videoLessons'),
            where('teacherId', '==', user.uid)
        );
        
        onSnapshot(q, (snapshot) => {
            const videos = [];
            snapshot.forEach((doc) => {
                videos.push({ id: doc.id, ...doc.data() });
            });

            // Sort by most recent first
            videos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            console.log('📊 Videos for table:', videos.length);

            managementTable.innerHTML = '';
            
            if (videos.length === 0) {
                managementTable.innerHTML = '<tr><td colspan="5" class="empty-cell">لا توجد فيديوهات</td></tr>';
            } else {
                const classMap = {
                    '1': 'الصف الأول الثانوي',
                    '2': 'الصف الثاني الثانوي',
                    '3': 'الصف الثالث الثانوي'
                };
                
                videos.forEach(video => {
                    const date = video.createdAt ? new Date(video.createdAt.toDate()).toLocaleDateString('ar-EG') : new Date(video.timestamp).toLocaleDateString('ar-EG');
                    
                    const row = managementTable.insertRow();
                    row.setAttribute('data-id', video.id);
                    row.innerHTML = `
                        <td>${video.title}</td>
                        <td>${classMap[video.classLevel] || 'غير محدد'}</td>
                        <td>${video.description}</td>
                        <td>${date}</td>
                        <td>
                            <button class="btn btn-warning btn-small" onclick="window.editVideoLesson('${video.id}', '${video.title.replace(/'/g, "\\'")}', '${video.classLevel}', '${video.youtubeUrl.replace(/'/g, "\\'")}', '${video.description.replace(/'/g, "\\'")}')">✏️ تعديل</button>
                            <button class="btn btn-danger btn-small" onclick="window.deleteVideoLesson('${video.id}')">🗑️ حذف</button>
                        </td>
                    `;
                });
            }
            
            console.log('✅ Videos table rendered');
        });

    } catch (error) {
        console.error('Error loading videos management table:', error);
    }
};

// ============================================
// Edit Video Lesson
// تعديل درس فيديو
// ============================================
window.editVideoLesson = function(videoId, title, classLevel, youtubeUrl, description) {
    console.log('✏️ Editing video:', videoId);
    
    document.getElementById('video-title').value = title;
    document.getElementById('video-class').value = classLevel;
    document.getElementById('youtube-link').value = youtubeUrl;
    document.getElementById('video-description').value = description;
    
    // Store the editing ID
    window.editingVideoId = videoId;
    
    // Scroll to form
    window.scrollTo({
        top: document.getElementById('video-title').offsetTop - 100,
        behavior: 'smooth'
    });
    
    document.getElementById('video-title').focus();
};

// ============================================
// Load Videos for Specific Class (Student View)
// تحميل فيديوهات صف محدد
// ============================================
window.loadClassVideos = async function(classNumber) {
    try {
        console.log('📹 loadClassVideos called for class:', classNumber);
        const videosGrid = document.getElementById('videos-grid');
        const emptyState = document.getElementById('empty-state');
        
        if (!videosGrid) {
            console.warn('❌ videos-grid element not found');
            return;
        }
        
        videosGrid.innerHTML = '';
        
        const classLevelStr = classNumber.toString();
        console.log('🔍 Searching for videos with classLevel:', classLevelStr);
        
        const q = query(
            collection(db, 'videoLessons'),
            where('classLevel', '==', classLevelStr)
        );
        
        onSnapshot(q, (snapshot) => {
            const videos = [];
            snapshot.forEach((doc) => {
                videos.push({ id: doc.id, ...doc.data() });
            });

            // Sort by most recent first
            videos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            console.log('📊 Class videos from Firebase:', videos.length, videos);

            if (videos.length === 0) {
                videosGrid.innerHTML = '';
                if (emptyState) {
                    emptyState.classList.remove('hidden');
                } else {
                    videosGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #a0a0a0; padding: 40px;">لا توجد دروس فيديو متاحة حالياً</p>';
                }
            } else {
                if (emptyState) {
                    emptyState.classList.add('hidden');
                }
                videosGrid.innerHTML = videos.map(video => `
                    <div class="video-card">
                        <div class="video-thumbnail" style="background-image:url('https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg')"></div>
                        <div class="video-info">
                            <h3 class="video-title">${video.title}</h3>
                            <p class="video-description">${video.description}</p>
                            <div class="video-actions">
                                <button class="btn-view" onclick="window.playVideo('${video.id}', '${video.title.replace(/'/g, "\\'")}', '${video.youtubeId}')">
                                    ▶ مشاهدة
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            console.log('✅ Class videos rendered');
        });

    } catch (error) {
        console.error('Error loading class videos:', error);
    }
};

// ============================================
// Initialize Video Page
// تهيئة صفحة الفيديو
// ============================================
window.initializeVideoPage = async function() {
    try {
        const teacherSection = document.getElementById('teacher-section');
        if (!teacherSection) return; // Not on video page

        const user = await getCurrentUser();
        if (user) {
            // Check if user is teacher
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().role === 'teacher') {
                teacherSection.classList.remove('hidden');
            }
        }

        // Load videos for everyone
        window.loadVideoLessons();

    } catch (error) {
        console.error('Error initializing video page:', error);
    }
};

// ============================================
// Initialize on page load
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('videos-grid')) {
            window.initializeVideoPage();
        }
    });
} else {
    if (document.getElementById('videos-grid')) {
        window.initializeVideoPage();
    }
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close fullscreen video
        const fullscreenModal = document.getElementById('fullscreen-video-modal');
        if (fullscreenModal && fullscreenModal.style.display === 'flex') {
            window.closeFullscreenVideo();
        }
        
        // Close old video player modal
        const modal = document.getElementById('video-player-modal');
        if (modal && modal.classList.contains('active')) {
            window.closeVideoPlayer();
        }
    }
});

// --- منع الكليك اليميني على صفحات الكلاس ---
document.addEventListener('contextmenu', function(e) {
    const currentPage = window.location.pathname;
    // تحقق إذا كنا على صفحة من صفحات الكلاس
    if (currentPage.includes('class-1') || currentPage.includes('class-2') || currentPage.includes('class-3')) {
        e.preventDefault();
        return false;
    }
});