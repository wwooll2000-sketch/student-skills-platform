// تكوين Firebase
// تحقق من https://console.firebase.google.com

const firebaseConfig = {
    apiKey: "AIzaSyCB1r7e9k1ReJPYEEZAYja5jkMJzeRNfcE",
    authDomain: "student-skills-platform.firebaseapp.com",
    projectId: "student-skills-platform",
    storageBucket: "student-skills-platform.firebasestorage.app",
    messagingSenderId: "270628922936",
    appId: "1:270628922936:web:e079dd34a7fedae8b268cd"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let isUsingFirebase = true; // تشغيل/إيقاف Firebase
const app = initializeApp(firebaseConfig);

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let isUsingFirebase = true; // تشغيل/إيقاف Firebase

// حفظ البيانات على Firebase
async function saveStudentsToFirebase(studentsData) {
    if (!isUsingFirebase) return;
    
    try {
        await db.collection('students').doc('all_students').set({
            data: studentsData,
            lastUpdated: new Date().toISOString()
        });
        console.log('✅ تم حفظ البيانات على Firebase');
    } catch (error) {
        console.error('❌ خطأ في حفظ البيانات:', error);
    }
}

// تحميل البيانات من Firebase
async function loadStudentsFromFirebase() {
    if (!isUsingFirebase) return null;
    
    try {
        const doc = await db.collection('students').doc('all_students').get();
        if (doc.exists) {
            console.log('✅ تم تحميل البيانات من Firebase');
            return doc.data().data || [];
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل البيانات:', error);
    }
    return null;
}

// حفظ طالب واحد
async function saveStudentToFirebase(student) {
    if (!isUsingFirebase) return;
    
    try {
        await db.collection('students').doc(student.id.toString()).set(student);
        console.log('✅ تم حفظ بيانات الطالب');
    } catch (error) {
        console.error('❌ خطأ:', error);
    }
}

// حذف طالب
async function deleteStudentFromFirebase(studentId) {
    if (!isUsingFirebase) return;
    
    try {
        await db.collection('students').doc(studentId.toString()).delete();
        console.log('✅ تم حذف الطالب');
    } catch (error) {
        console.error('❌ خطأ:', error);
    }
}
