const admin = require("firebase-admin");
const fs = require("fs");

// Load service account
const serviceAccount = require("./firebaseServiceKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Load JSON file
const questions = JSON.parse(
  fs.readFileSync("./prelims_daily.json", "utf8")
);

async function uploadQuestions() {
  const batch = db.batch();

  questions.forEach((q) => {
    const docRef = db
      .collection("prelims")
      .doc("2060")
      .collection("questions")
      .doc(q.questionNumber.toString());

    batch.set(docRef, q);
  });

  await batch.commit();
  console.log("✅ daily Questions Uploaded Successfully");
}

uploadQuestions();
