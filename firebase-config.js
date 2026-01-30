// تكوين Firebase
// تحقق من https://console.firebase.google.com

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

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
