import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

// استيراد دالة الحذف الخاصة بالـ Authentication
import { deleteUser as deleteAuthUser } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

window.deleteUser = async function(id) {
    // حذف فوري بدون رسائل
    await deleteDoc(doc(db, "users", id));
};

// عرض اسم الطالب في صفحة الدروس
if (document.getElementById("welcome-name")) {
    document.getElementById("welcome-name").innerText = "أهلاً بك يا " + localStorage.getItem("userName");
}


// استيراد دالة مراقبة حالة المستخدم (تأكد أنها موجودة في أول الملف مع الـ imports)
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
   Dark Mode & UI Functions (Global)
   ============================================ */

window.initDarkMode = function() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    const btn = document.getElementById('dark-mode-btn');
    if (isDark) {
        document.body.classList.add('dark-mode');
        if (btn) btn.textContent = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        if (btn) btn.textContent = '🌙';
    }
};

window.toggleDarkMode = function() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    const newState = !isDark;
    localStorage.setItem('darkMode', newState);
    window.initDarkMode();
};

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
    window.initDarkMode();
    window.checkTeacherLogin();
    window.initDropdownMenu();

    // Show welcome message on index
    if (document.getElementById("welcome-name")) {
        const userName = localStorage.getItem("userName");
        if (userName) {
            document.getElementById("welcome-name").innerText = "أهلاً بك يا " + userName;
        }
    }

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

    // Load data from Firestore on initial page load
    if (typeof window.loadExamsFromCloud === 'function') window.loadExamsFromCloud();
    if (typeof window.loadLessonsFromCloud === 'function') window.loadLessonsFromCloud();
    if (typeof window.loadMeetingsFromCloud === 'function') window.loadMeetingsFromCloud();
    if (typeof window.loadCentersFromCloud === 'function') window.loadCentersFromCloud();
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
        alert('✅ تم حذف الدرس بنجاح');
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
    
    alert('تم تحميل بيانات الدرس. عدّل ما تريده ثم اضغط "إضافة الدرس" لحفظ التعديلات');
};

window.joinMeeting = function(link) {
    if (!link) return alert('لا يوجد رابط صالح للاجتماع');
    window.open(link, '_blank');
};

/* ============================================
   Index Page - Meetings Management
   ============================================ */

window.loadMeetingsFromCloudIndex = function() {
    const q = query(collection(db, 'meetings'));
    onSnapshot(q, (snapshot) => {
        const meetings = [];
        snapshot.forEach(docSnap => meetings.push(docSnap.data()));
        localStorage.setItem('meetings', JSON.stringify(meetings));
        window.renderIndexMeetings();
        window.updateIndexMeetingButtons();
    });
};

window.renderIndexMeetings = function() {
    const container = document.getElementById('index-meetings-list');
    const meetings = JSON.parse(localStorage.getItem('meetings') || '[]');
    if (!container) return;
    container.innerHTML = '';
    if (meetings.length === 0) {
        container.innerHTML = '<div class="empty-cell">لا توجد اجتماعات حالياً</div>';
        return;
    }
    const classMap = { '1': 'الصف الأول الثانوي', '2': 'الصف الثاني الثانوي', '3': 'الصف الثالث الثانوي' };
    meetings.forEach(m => {
        const start = m.startTimestamp || (m.datetime ? new Date(m.datetime).getTime() : NaN);
        const dt = new Date(start);
        const dateStr = isNaN(dt) ? (m.datetime || '-') : dt.toLocaleDateString('ar-EG');
        const timeStr = isNaN(dt) ? '-' : dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        const wrapper = document.createElement('div');
        wrapper.className = 'meeting-item card';

        const btn = document.createElement('a');
        btn.className = 'btn btn-primary';
        btn.id = 'idx-btn-' + m.id;
        btn.style.width = '100%';
        btn.style.textAlign = 'right';
        btn.target = '_blank';
        btn.rel = 'noopener';
        btn.removeAttribute('href');
        btn.style.pointerEvents = 'none';

        const titleHtml = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div style="text-align:right"><strong>${classMap[m.class] || m.class}</strong><div style="font-size:0.9rem;color:#ffffff">${dateStr} — ${timeStr}</div></div><div id="idx-remaining-${m.id}" style="min-width:90px;text-align:left;font-weight:700">--:--</div></div>`;
        btn.innerHTML = titleHtml;
        wrapper.appendChild(btn);

        container.appendChild(wrapper);
    });
};

window.updateIndexMeetingButtons = function() {
    const meetings = JSON.parse(localStorage.getItem('meetings') || '[]');
    const now = Date.now();
    meetings.forEach(m => {
        const btn = document.getElementById('idx-btn-' + m.id);
        const remEl = document.getElementById('idx-remaining-' + m.id);
        if (!btn || !remEl) return;
        const start = m.startTimestamp || (m.datetime ? new Date(m.datetime).getTime() : NaN);
        if (isNaN(start)) { remEl.textContent = '--:--'; btn.disabled = true; return; }
        const diff = start - now;
        const enableAt = start - (5 * 60 * 1000);

        if (now >= enableAt && now <= (start + (3 * 60 * 60 * 1000))) {
            btn.href = m.link;
            btn.style.pointerEvents = 'auto';
            remEl.textContent = 'مفتوح الآن';
        } else if (diff > 0) {
            btn.removeAttribute('href');
            btn.style.pointerEvents = 'none';
            let remaining = diff;
            const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
            remaining -= days * (1000 * 60 * 60 * 24);
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            remaining -= hours * (1000 * 60 * 60);
            const minutes = Math.floor(remaining / (1000 * 60));

            const dStr = days > 0 ? `${days} ي ` : '';
            const hStr = `${hours} س `;
            const mStr = `${minutes} د `;
            remEl.textContent = `${dStr}${hStr}${mStr}`;
        } else {
            btn.disabled = true;
            remEl.textContent = 'انتهى';
        }
    });
};

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
        card.innerHTML = `<div style="text-align:right"><strong>${c.name}</strong><div style="color:var(--text-secondary)">${c.address || ''}</div></div>`;
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
    const lat = parseFloat(prompt('خط العرض:', c.lat)) || c.lat;
    const lng = parseFloat(prompt('خط الطول:', c.lng)) || c.lng;
    window.updateCenter({ id: c.id, name, address, lat, lng });
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

// Dark mode functions
window.initDarkMode = function() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    const btn = document.getElementById('dark-mode-btn');
    if (isDark) {
        document.body.classList.add('dark-mode');
        if (btn) btn.textContent = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        if (btn) btn.textContent = '🌙';
    }
};

window.toggleDarkMode = function() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    const newState = !isDark;
    localStorage.setItem('darkMode', newState);
    window.initDarkMode();
};

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

// Render all exams
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

// Initialize page on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize dark mode
    window.initDarkMode && window.initDarkMode();

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
    }, 1000);
});