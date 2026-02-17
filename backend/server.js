require('dotenv').config();

const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const cors = require('cors');
const admin = require("firebase-admin");
const serviceAccount = require("./firebaseServiceKey.json");

/* ---------------- INITIALIZE FIREBASE ADMIN ---------------- */

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

/* ---------------- EXPRESS APP ---------------- */

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- MULTER CONFIG ---------------- */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'));
    }
  }
});

/* ---------------- AWS CONFIG ---------------- */

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

/* ---------------- UPLOAD ROUTE ---------------- */

app.post('/upload', upload.single('file'), async (req, res) => {
  try {

    console.log("Upload route hit");

    /* ---- Verify Firebase Token ---- */

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    /* ---- Validate Question ID ---- */

    const questionId = req.body.questionId;

    if (!questionId) {
      return res.status(400).json({ error: "Missing question ID" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("User:", uid);
    console.log("Question:", questionId);

    /* ---- Firestore Duplicate Check ---- */

    const db = admin.firestore();
    const submissionRef = db.collection("submissions")
      .doc(`${uid}_${questionId}`);

    const existing = await submissionRef.get();

    if (existing.exists) {
      return res.status(400).json({
        error: "You have already submitted this question."
      });
    }

    /* ---- Upload to S3 ---- */

    const file = req.file;

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: `answers/${uid}/${questionId}-${Date.now()}-${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype
    };

    await s3.upload(params).promise();

    /* ---- Save Submission Record ---- */

    await submissionRef.set({
      uid: uid,
      questionId: questionId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log("Submission saved to Firestore");

    return res.json({ message: "Upload successful" });

  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

/* ---------------- START SERVER ---------------- */

app.listen(5000, () => {
  console.log("Server running at http://localhost:5000");
});
