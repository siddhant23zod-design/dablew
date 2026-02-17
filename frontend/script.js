import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,   // ✅ ADD THIS
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------------- FIREBASE CONFIG ---------------- */

const firebaseConfig = {
  apiKey: "AIzaSyA3nfcMUMUTbDLRDK9unGbR3WoLH41u5H4",
  authDomain: "dablew-in.firebaseapp.com",
  projectId: "dablew-in",
  storageBucket: "dablew-in.firebasestorage.app",
  messagingSenderId: "991357387713",
  appId: "1:991357387713:web:a5a2b0b623990941546540",
  measurementId: "G-07JK1X0ES9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentQuestionId = null;

/* ---------------- LOAD MAINS QUESTIONS ---------------- */

async function loadMainsQuestions(user) {
  try {
    const docRef = doc(db, "mains", "today");
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.error("No mains questions found");
      return;
    }

    const questions = docSnap.data().questions;
    const container = document.getElementById("mains-questions");

    if (!container) {
      console.error("Mains container not found in DOM");
      return;
    }

    container.innerHTML = ""; // clear old content

    questions.forEach(q => {
      const card = document.createElement("div");
      card.className = "rect-card";
      card.setAttribute("data-question", q.id);
      card.onclick = () => openUpload(q.id);

      card.innerHTML = `
        <span class="q-tag">${q.title}</span>
        <p>${q.question}</p>
      `;

      container.appendChild(card);
    });

    await markSubmittedQuestions(user);

  } catch (error) {
    console.error("Error loading mains questions:", error);
  }
}


/* ---------------- MARK SUBMITTED ---------------- */

async function markSubmittedQuestions(user) {
  const submissionsRef = collection(db, "submissions");
  const q = query(submissionsRef, where("uid", "==", user.uid));
  const snapshot = await getDocs(q);

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const questionId = data.questionId;

    const card = document.querySelector(`[data-question="${questionId}"]`);
    if (card) {
      card.classList.add("submitted");
      card.removeAttribute("onclick");
    }
  });
}

/* ---------------- MODAL TOGGLE ---------------- */

window.toggleModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display =
      modal.style.display === "block" ? "none" : "block";
  }
};

/* ---------------- SIGNUP ---------------- */

/* ---------------- SIGNUP ---------------- */

window.handleSignup = async function (e) {
  e.preventDefault();

  const email = e.target.querySelector('input[type="email"]').value;
  const password = e.target.querySelector('input[type="password"]').value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await sendEmailVerification(userCredential.user);

    toggleModal('signupModal');

    showMessage(
      "Verification Email Sent",
      "A verification link has been sent to your email. Please verify your account before logging in."
    );

  } catch (error) {
    showMessage("Signup Error", error.message);
  }
};

/* ---------------- LOGIN ---------------- */

window.handleLogin = async function (e) {
  e.preventDefault();

  const email = e.target.querySelector('input[type="email"]').value;
  const password = e.target.querySelector('input[type="password"]').value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    if (!userCredential.user.emailVerified) {
      await signOut(auth);

      showMessage(
        "Email Not Verified",
        "Please verify your email address before logging in."
      );
      return;
    }

    // Close login modal if open
    const loginModal = document.getElementById("loginModal");
    if (loginModal) loginModal.style.display = "none";

    const signupModal = document.getElementById("signupModal");
    if (signupModal) signupModal.style.display = "none";

    // Smart redirection
    const currentPath = window.location.pathname;

    if (currentPath.includes("prelims")) {
      window.location.href = "quiz.html?year=2060";
      return;
    }

    if (currentPath.includes("mains")) {
      window.location.reload();
      return;
    }

    window.location.reload();

  } catch (error) {

    let message = "Login failed. Please try again.";

    if (error.code === "auth/user-not-found") {
      message = "No account found with this email.";
    }

    if (error.code === "auth/wrong-password") {
      message = "Incorrect password. Please try again.";
    }

    if (error.code === "auth/invalid-email") {
      message = "Invalid email format.";
    }

    if (error.code === "auth/too-many-requests") {
      message = "Too many failed attempts. Please try again later.";
    }

    showMessage("Login Error", message);
  }
};
/* ---------------- FORGOT PASSWORD ---------------- */

window.handleForgotPassword = async function () {

  const modalEmail = document.getElementById("modal-login-email");
  const gatewayEmail = document.getElementById("gateway-login-email");

  const email =
    (modalEmail && modalEmail.value) ||
    (gatewayEmail && gatewayEmail.value);

  if (!email) {
    showMessage("Email Required", "Please enter your email address first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    showMessage(
      "Reset Link Sent",
      "A password reset link has been sent to your email. Please check your inbox."
    );

  } catch (error) {
    showMessage("Error", error.message);
  }
};


/* ---------------- LOGOUT ---------------- */

window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
};

/* ---------------- AUTH STATE ---------------- */

onAuthStateChanged(auth, async (user) => {
  const authNav = document.getElementById('auth-buttons');
  const userNav = document.getElementById('user-profile');
  const nameDisplay = document.getElementById('display-name');
  const loginGateway = document.getElementById('login-gateway');
  const mainsContent = document.getElementById('mains-content');

  if (user && user.emailVerified) {

    if (authNav) authNav.style.display = 'none';
    if (userNav) {
      userNav.style.display = 'flex';
      if (nameDisplay) nameDisplay.innerText = user.email;
    }

    if (loginGateway) loginGateway.style.display = 'none';
    if (mainsContent) mainsContent.style.display = 'block';

    // 🔥 LOAD QUESTIONS AFTER LOGIN
    await loadMainsQuestions(user);

  } else {
    if (authNav) authNav.style.display = 'flex';
    if (userNav) userNav.style.display = 'none';
    if (loginGateway) loginGateway.style.display = 'block';
    if (mainsContent) mainsContent.style.display = 'none';
  }
});

/* ---------------- OPEN UPLOAD ---------------- */

window.openUpload = function (questionId) {
  currentQuestionId = questionId;
  document.getElementById("uploadModal").style.display = "block";
};

/* ---------------- UPLOAD FUNCTION ---------------- */

window.validateAndUpload = async function () {
  const fileInput = document.getElementById('answer-file');
  const errorMsg = document.getElementById('file-error-msg');

  if (!fileInput.files.length) {
    alert("Please select a file first.");
    return;
  }

  const file = fileInput.files[0];
  const maxSizeInBytes = 2 * 1024 * 1024;

  if (file.type !== "application/pdf") {
    alert("Only PDF files are allowed.");
    return;
  }

  if (file.size > maxSizeInBytes) {
    errorMsg.innerText = "Size should be less than 2MB";
    errorMsg.style.display = "block";
    return;
  }

  errorMsg.style.display = "none";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("questionId", currentQuestionId);

  try {
    const user = auth.currentUser;
    const token = await user.getIdToken();

    const response = await fetch("https://api.dablew.in/upload", {

      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(
  "Submission Successful",
  "Your answer has been uploaded successfully for evaluation."
);

      toggleModal("uploadModal");

      const card = document.querySelector(`[data-question="${currentQuestionId}"]`);
      if (card) {
        card.classList.add("submitted");
        card.removeAttribute("onclick");
      }

    } else {
      alert(data.error || "Upload failed.");
    }

  } catch (error) {
    console.error(error);
    alert("Server error during upload.");
  }
};
/* ---------------- TODAY'S QUESTIONS ACCESS ---------------- */

const todayCard = document.getElementById("today-card");

if (todayCard) {

  todayCard.addEventListener("click", () => {

    const user = auth.currentUser;

    if (user && user.emailVerified) {
      window.location.href = "quiz.html?year=2060";
    } else {
      toggleModal("loginModal");
    }
  });

}
/* ---------------- SHOW MESSAGE MODAL ---------------- */

window.showMessage = function (title, message) {

  document.getElementById("message-title").innerText = title;
  document.getElementById("message-text").innerText = message;

  toggleModal("messageModal");
};
window.goToHabitTracker = async function () {

    const user = auth.currentUser;

    if (!user) {
        toggleModal('loginModal');
        return;
    }

    const habitConfigRef = doc(db, "users", user.uid, "habitMeta", "config");
    const snap = await getDoc(habitConfigRef);

    if (snap.exists()) {
        window.location.href = "habit-tracker.html";
    } else {
        window.location.href = "habit-setup.html";
    }
};



