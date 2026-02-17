import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    getDocs, 
    collection 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= FIREBASE ================= */

const firebaseConfig = {
  apiKey: "AIzaSyA3nfcMUMUTbDLRDK9unGbR3WoLH41u5H4",
  authDomain: "dablew-in.firebaseapp.com",
  projectId: "dablew-in"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ================= STATE ================= */

let currentUser = null;
let habits = [];
let dailyData = {};
let startDate = null;

/* ================= DOM ================= */

const habitList = document.getElementById("habit-list");
const scoreDisplay = document.getElementById("dailyScore");

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;
    document.getElementById("display-name").innerText = user.email;

    await loadHabits();        // renders buttons
    await loadTodayData();     // loads dailyData

    restoreButtonStates();     // 🔥 now buttons exist
    updateScore();

    generateWeekGrid();
});


/* ================= LOAD HABITS ================= */

async function loadHabits() {

    const docRef = doc(db, "users", currentUser.uid, "habitMeta", "config");
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
        window.location.href = "habit-setup.html";
        return;
    }

    const data = snap.data();
    habits = data.habits || [];

    if (data.startDate && typeof data.startDate.toDate === "function") {
        startDate = data.startDate.toDate();
    } else {
        startDate = new Date();
        await setDoc(docRef, { startDate: new Date() }, { merge: true });
    }

    renderHabits();
}

/* ================= RENDER HABITS ================= */

function renderHabits() {

    habitList.innerHTML = "";

    habits.forEach((habit, index) => {

        const row = document.createElement("div");
        row.className = "habit-row";

        row.innerHTML = `
            <div class="habit-name">${habit}</div>
            <div class="habit-actions">
                <button class="habit-btn tick-btn" data-index="${index}" data-value="0.66">✔</button>
                <button class="habit-btn cross-btn" data-index="${index}" data-value="-2">✖</button>
            </div>
        `;

        habitList.appendChild(row);
    });

    attachListeners();
    restoreButtonStates();
}

/* ================= LISTENERS ================= */

function attachListeners() {

    document.querySelectorAll(".habit-btn").forEach(btn => {

        btn.addEventListener("click", async () => {

            const index = btn.dataset.index;
            const value = parseFloat(btn.dataset.value);

            dailyData[index] = value;

            const tickBtn = document.querySelector(`.tick-btn[data-index="${index}"]`);
            const crossBtn = document.querySelector(`.cross-btn[data-index="${index}"]`);

            if (!tickBtn || !crossBtn) return;

            tickBtn.classList.remove("selected-tick", "disabled-btn");
            crossBtn.classList.remove("selected-cross", "disabled-btn");

            if (value === 0.66) {
                tickBtn.classList.add("selected-tick");
                crossBtn.classList.add("disabled-btn");
            } else {
                crossBtn.classList.add("selected-cross");
                tickBtn.classList.add("disabled-btn");
            }

            await saveToday();
            updateScore();
        });
    });
}

/* ================= RESTORE BUTTON STATE ================= */

function restoreButtonStates() {

    Object.keys(dailyData).forEach(index => {

        const value = dailyData[index];

        const tickBtn = document.querySelector(`.tick-btn[data-index="${index}"]`);
        const crossBtn = document.querySelector(`.cross-btn[data-index="${index}"]`);

        if (!tickBtn || !crossBtn) return;

        // 🔥 RESET EVERYTHING FIRST
        tickBtn.classList.remove("selected-tick", "disabled-btn");
        crossBtn.classList.remove("selected-cross", "disabled-btn");

        // 🔥 APPLY CORRECT STATE
        if (value === 0.66) {
            tickBtn.classList.add("selected-tick");
            crossBtn.classList.add("disabled-btn");
        }

        if (value === -2) {
            crossBtn.classList.add("selected-cross");
            tickBtn.classList.add("disabled-btn");
        }
    });
}

/* ================= DATE HELPERS ================= */

function getTodayString() {
    const d = new Date();
    return d.toISOString().split("T")[0];
}

function getWeekNumber() {
    const today = new Date();
    const diff = today - startDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return Math.floor(days / 7) + 1;
}

/* ================= LOAD TODAY ================= */

async function loadTodayData() {

    const todayRef = doc(db, "users", currentUser.uid, "habitDaily", getTodayString());
    const snap = await getDoc(todayRef);

    if (snap.exists()) {
        dailyData = snap.data().entries || {};
    }
}


/* ================= SAVE TODAY ================= */

async function saveToday() {

    const score = calculateScore();
    const weekNumber = getWeekNumber();

    const todayRef = doc(db, "users", currentUser.uid, "habitDaily", getTodayString());

    await setDoc(todayRef, {
        entries: dailyData,
        score: score,
        week: weekNumber,
        date: new Date()
    });

    await updateWeeklyScore(weekNumber);
}

/* ================= SCORE ================= */

function calculateScore() {
    let total = 0;
    Object.values(dailyData).forEach(v => total += v);
    return total;
}

function updateScore() {
    scoreDisplay.innerText = "Today's Score: " + calculateScore().toFixed(2);
}

/* ================= WEEKLY UPDATE ================= */

async function updateWeeklyScore(weekNumber) {

    const weekRef = doc(db, "users", currentUser.uid, "habitWeekly", weekNumber.toString());
    const weekSnap = await getDoc(weekRef);

    const todayScore = calculateScore();
    const todayString = getTodayString();

    let weekData = {};

    if (weekSnap.exists()) {
        weekData = weekSnap.data().days || {};
    }

    weekData[todayString] = todayScore;

    let weeklyTotal = 0;
    Object.values(weekData).forEach(score => weeklyTotal += score);

    await setDoc(weekRef, {
        days: weekData,
        total: weeklyTotal
    });

    generateWeekGrid();
}

/* ================= WEEK GRID ================= */

function generateWeekGrid() {

    const grid = document.getElementById("week-grid");
    grid.innerHTML = "";

    const currentWeek = getWeekNumber();

    for (let i = 1; i <= 101; i++) {

        const weekBox = document.createElement("div");
        weekBox.classList.add("week-box");
        weekBox.id = `week-${i}`;

        weekBox.innerHTML = `
            W${i}
            <span id="week-score-${i}">0</span>
        `;

        if (i === currentWeek) weekBox.classList.add("week-current");
        if (i > currentWeek) weekBox.classList.add("week-future");

        grid.appendChild(weekBox);
    }

    loadWeeklyScores();
}

/* ================= LOAD WEEKLY SCORES ================= */

async function loadWeeklyScores() {

    const weeklyRef = collection(db, "users", currentUser.uid, "habitWeekly");
    const snapshot = await getDocs(weeklyRef);

    snapshot.forEach(docSnap => {

        const weekNumber = parseInt(docSnap.id);
        const total = docSnap.data().total;

        const scoreElement = document.getElementById(`week-score-${weekNumber}`);
        const weekBox = document.getElementById(`week-${weekNumber}`);

        if (!scoreElement || !weekBox) return;

        scoreElement.innerText = total.toFixed(2);

        if (total > 0) weekBox.classList.add("week-positive");
        else if (total < 0) weekBox.classList.add("week-negative");
    });
}
