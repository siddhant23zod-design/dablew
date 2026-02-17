/* ================= GLOBAL STATE ================= */

let allQuestions = [];
let currentPage = 0;
const questionsPerPage = 7;
let userAnswers = {};
let timerInterval;
let quitModalInitialized = false;
let testSubmitted = false;

/* ================= GET YEAR ================= */

const urlParams = new URLSearchParams(window.location.search);
const year = urlParams.get("year");

/* ================= FIREBASE ================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA3nfcMUMUTbDLRDK9unGbR3WoLH41u5H4",
  authDomain: "dablew-in.firebaseapp.com",
  projectId: "dablew-in"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ================= INITIAL LOAD ================= */

window.addEventListener("DOMContentLoaded", () => {

  if (!year) {
    alert("No year selected.");
    return;
  }

  onAuthStateChanged(auth, (user) => {

    if (year === "2060" && !user) {
      console.log("Login required for today's questions.");
      return;
    }

    loadQuestions(year);
    startTimer();
    initThemeToggle();
    initQuitProtection();
  });

});


/* ================= LOAD QUESTIONS ================= */

async function loadQuestions(year) {
  try {
    const snapshot = await getDocs(
      collection(db, "prelims", year, "questions")
    );

    allQuestions = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      if (!Array.isArray(data.options) && data.a) {
        data.options = [data.a, data.b, data.c, data.d];
      }

      allQuestions.push(data);
    });

    allQuestions.sort((a, b) => a.questionNumber - b.questionNumber);
    renderPage();

  } catch (error) {
    console.error("Error loading questions:", error);
  }
}

/* ================= RENDER PAGE ================= */

function renderPage() {

  const container = document.getElementById("quiz-container");
  if (!container) return;

  container.innerHTML = "";

  const start = currentPage * questionsPerPage;
  const end = start + questionsPerPage;
  const pageQuestions = allQuestions.slice(start, end);

  pageQuestions.forEach(question => {

    const options = Array.isArray(question.options) ? question.options : [];

    const qDiv = document.createElement("div");
    qDiv.classList.add("question-card");

    qDiv.innerHTML = `
      <h3>Q${question.questionNumber}. ${question.question}</h3>
      <div class="options">
        ${options.map(option => `
          <label class="option-btn ${userAnswers[question.questionNumber] === option ? "selected" : ""}">
            <input type="radio"
              name="q${question.questionNumber}"
              value="${option}"
              ${userAnswers[question.questionNumber] === option ? "checked" : ""}
            />
            <span>${option}</span>
          </label>
        `).join("")}
      </div>
    `;

    container.appendChild(qDiv);
  });

  attachOptionListeners();
  renderNavigationButtons();
  renderPalette();
}

/* ================= OPTION LISTENERS ================= */

function attachOptionListeners() {

  document.querySelectorAll(".option-btn").forEach(label => {

    const input = label.querySelector("input");

    label.addEventListener("click", (e) => {

      e.preventDefault();

      const qNum = input.name.replace("q", "");
      const optionValue = input.value;
      const alreadySelected = userAnswers[qNum] === optionValue;

      document.querySelectorAll(`input[name="q${qNum}"]`).forEach(radio => {
        radio.checked = false;
        radio.closest(".option-btn").classList.remove("selected");
      });

      if (alreadySelected) {
        delete userAnswers[qNum];
      } else {
        input.checked = true;
        label.classList.add("selected");
        userAnswers[qNum] = optionValue;
      }

      renderPalette();
    });

  });
}

/* ================= NAVIGATION ================= */

function renderNavigationButtons() {

  const navDiv = document.getElementById("quiz-navigation");
  if (!navDiv) return;

  navDiv.innerHTML = "";

  const totalPages = Math.ceil(allQuestions.length / questionsPerPage);

  if (currentPage > 0) {
    const prevBtn = document.createElement("button");
    prevBtn.innerText = "Previous Page";
    prevBtn.className = "nav-btn";
    prevBtn.onclick = () => {
      currentPage--;
      renderPage();
    };
    navDiv.appendChild(prevBtn);
  }

  const submitBtn = document.createElement("button");
  submitBtn.innerText = "Submit";
  submitBtn.className = "submit-btn";
  submitBtn.onclick = submitQuiz;
  navDiv.appendChild(submitBtn);

  if (currentPage < totalPages - 1) {
    const nextBtn = document.createElement("button");
    nextBtn.innerText = "Next Page";
    nextBtn.className = "nav-btn";
    nextBtn.onclick = () => {
      currentPage++;
      renderPage();
    };
    navDiv.appendChild(nextBtn);
  }
}

/* ================= QUESTION PALETTE ================= */

function renderPalette() {

  const palette = document.getElementById("question-palette");
  if (!palette) return;

  palette.innerHTML = "";

  allQuestions.forEach(q => {

    const btn = document.createElement("button");
    btn.innerText = q.questionNumber;
    btn.classList.add("palette-btn");

    if (userAnswers[q.questionNumber]) {
      btn.classList.add("palette-attempted");
    } else {
      btn.classList.add("palette-unattempted");
    }

    btn.onclick = () => {
      currentPage = Math.floor((q.questionNumber - 1) / questionsPerPage);
      renderPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    palette.appendChild(btn);
  });
}

/* ================= TIMER ================= */

function startTimer() {

  let timeLeft = 2 * 60 * 60;

  timerInterval = setInterval(() => {

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitQuiz();
      return;
    }

    timeLeft--;

    const hrs = String(Math.floor(timeLeft / 3600)).padStart(2, "0");
    const mins = String(Math.floor((timeLeft % 3600) / 60)).padStart(2, "0");
    const secs = String(timeLeft % 60).padStart(2, "0");

    const timerEl = document.getElementById("timer");
    if (timerEl) timerEl.innerText = `${hrs}:${mins}:${secs}`;

  }, 1000);
}

/* ================= SUBMIT ================= */

function submitQuiz() {

  testSubmitted = true;
  clearInterval(timerInterval);

  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  allQuestions.forEach(q => {

    const selected = userAnswers[q.questionNumber];
    if (!selected) {
      skipped++;
      return;
    }

    const options = q.options || [];
    let correctOption =
      typeof q.correctAnswer === "number"
        ? options[q.correctAnswer - 1]
        : q.correctAnswer;

    if (
      selected &&
      correctOption &&
      selected.toString().trim().toLowerCase() ===
      correctOption.toString().trim().toLowerCase()
    ) {
      correct++;
    } else {
      wrong++;
    }
  });

  const attempted = correct + wrong;
  const score = (correct * 2) - (wrong * 0.66);

  showFullResult({
    correct,
    wrong,
    skipped,
    attempted,
    score: score.toFixed(2)
  });
}

/* ================= RESULT DISPLAY ================= */

function showFullResult(result) {

  const left = document.querySelector(".quiz-left");
  const right = document.querySelector(".quiz-right");

  let questionsHTML = "";

  allQuestions.forEach(q => {

    const selected = userAnswers[q.questionNumber];
    const options = q.options || [];

    let correctOption =
      typeof q.correctAnswer === "number"
        ? options[q.correctAnswer - 1]
        : q.correctAnswer;

    const optionsHTML = options.map(option => {

      let className = "review-option";

      const optionText = option?.toString().trim().toLowerCase();
      const selectedText = selected?.toString().trim().toLowerCase();
      const correctText = correctOption?.toString().trim().toLowerCase();

      if (selectedText && optionText === selectedText && optionText === correctText) {
        className += " review-correct-selected";
      }
      else if (selectedText && optionText === selectedText && optionText !== correctText) {
        className += " review-wrong-selected";
      }
      else if (correctText && optionText === correctText) {
        className += " review-correct";
      }

      return `<div class="${className}">${option}</div>`;
    }).join("");

    questionsHTML += `
      <div class="review-question">
        <h4>Q${q.questionNumber}. ${q.question}</h4>
        <div class="review-options">
          ${optionsHTML}
        </div>
      </div>
    `;
  });

  left.innerHTML = `
    <div class="result-card">
        <h2>Test Completed</h2>
        <div class="result-grid">
            <div><span>Score</span><span>${result.score}</span></div>
            <div><span>Attempted</span><span>${result.attempted}</span></div>
            <div><span>Correct</span><span>${result.correct}</span></div>
            <div><span>Wrong</span><span>${result.wrong}</span></div>
            <div><span>Unattempted</span><span>${result.skipped}</span></div>
        </div>
    </div>
    <div class="review-container">${questionsHTML}</div>
  `;

  if (right) right.remove();
}

/* ================= DARK MODE ================= */

function initThemeToggle() {

  const themeToggle = document.getElementById("theme-toggle");
  if (!themeToggle) return;

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.innerText = "☀️";
  } else {
    themeToggle.innerText = "🌙";
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    if (document.body.classList.contains("dark-mode")) {
      localStorage.setItem("theme", "dark");
      themeToggle.innerText = "☀️";
    } else {
      localStorage.setItem("theme", "light");
      themeToggle.innerText = "🌙";
    }
  });
}

/* ================= QUIT PROTECTION ================= */

function initQuitProtection() {

  if (quitModalInitialized) return;
  quitModalInitialized = true;

  const logo = document.querySelector(".logo");
  if (!logo) return;

  const modal = document.createElement("div");
  modal.id = "endTestModal";
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-content">
      <div class="close-btn-wrapper" id="closeEndTestModal">
          <span class="close-x">&times;</span>
      </div>
      <h3>End Test?</h3>
      <p style="margin-bottom:20px;">
        Are you sure you want to end this test? Your progress will be lost.
      </p>
      <div class="flex-buttons">
          <button class="btn-red" id="confirmEndTest">Yes</button>
          <button class="btn-grey" id="cancelEndTest">No</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ---- PROTECTION HANDLERS ----

  function preventRefresh(e) {
    if (!testSubmitted) {
      e.preventDefault();
      e.returnValue = "";
    }
  }

  function backHandler() {
    if (!testSubmitted) {
      modal.style.display = "block";
      history.pushState({ quiz: true }, "", location.href);
    }
  }

  window.addEventListener("beforeunload", preventRefresh);
  history.pushState({ quiz: true }, "", location.href);
  window.addEventListener("popstate", backHandler);

  // ---- YES BUTTON ----

  document.getElementById("confirmEndTest").onclick = () => {

    testSubmitted = true;

    window.removeEventListener("beforeunload", preventRefresh);
    window.removeEventListener("popstate", backHandler);

    window.location.replace("index.html");
  };

  // ---- NO BUTTON ----

  document.getElementById("cancelEndTest").onclick = () => {
    modal.style.display = "none";
  };

  document.getElementById("closeEndTestModal").onclick = () => {
    modal.style.display = "none";
  };

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  // ---- LOGO CLICK ----

  logo.addEventListener("click", (e) => {
    e.preventDefault();

    if (testSubmitted) {
      window.location.replace("index.html");
    } else {
      modal.style.display = "block";
    }
  });
}

