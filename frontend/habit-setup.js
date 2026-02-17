import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA3nfcMUMUTbDLRDK9unGbR3WoLH41u5H4",
  authDomain: "dablew-in.firebaseapp.com",
  projectId: "dablew-in"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const habitContainer = document.getElementById("habit-inputs");
const saveBtn = document.getElementById("saveHabitsBtn");

let currentUser = null;

/* ================= AUTH CHECK ================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;
    document.getElementById("display-name").innerText = user.email;

    generateInputs();
    await loadExistingHabits();
});

/* ================= GENERATE 13 INPUTS ================= */

function generateInputs(existingHabits = []) {

    habitContainer.innerHTML = "";

    for (let i = 0; i < 13; i++) {

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = `Habit ${i + 1}`;
        input.value = existingHabits[i] || "";
        input.id = `habit-${i}`;

        habitContainer.appendChild(input);
    }
}

/* ================= LOAD EXISTING HABITS ================= */

async function loadExistingHabits() {

    const docRef = doc(db, "users", currentUser.uid, "habitMeta", "config");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        generateInputs(data.habits || []);
    }
}

/* ================= SAVE HABITS ================= */

saveBtn.addEventListener("click", async () => {

    const habits = [];

    for (let i = 0; i < 13; i++) {
        const value = document.getElementById(`habit-${i}`).value.trim();
        habits.push(value);
    }

    if (habits.some(h => h === "")) {
        alert("All 13 habits must be filled.");
        return;
    }

    const docRef = doc(db, "users", currentUser.uid, "habitMeta", "config");
    const existing = await getDoc(docRef);

    const dataToSave = {
        habits: habits,
        updatedAt: new Date()
    };

    // Preserve original start date if it exists
    if (existing.exists()) {
        const oldData = existing.data();
        if (oldData.startDate) {
            dataToSave.startDate = oldData.startDate;
        } else {
            dataToSave.startDate = new Date();
        }
    } else {
        dataToSave.startDate = new Date();
    }

    await setDoc(docRef, dataToSave);

    // Redirect cleanly
    window.location.href = "habit-tracker.html";
});
