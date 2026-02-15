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

        onAuthStateChanged(auth, (user) => {
            if (!user) {
                // لو حد حاول يدخل وهو مش مسجل، ابعته لصفحة الدخول
                window.location.href = "login.html";
            }
        });
    }
}

// تشغيل الحماية
protectPhysicsPlatform();