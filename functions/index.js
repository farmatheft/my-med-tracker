const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));

// Simple health check
app.get("/health", (req, res) => {
    res.status(200).send("Backend is running!");
});

// Example API to get all intakes for a patient
app.get("/intakes/:patientId", async (req, res) => {
    try {
        const { patientId } = req.params;
        const snapshot = await db.collection("intakes")
            .where("patientId", "==", patientId)
            .orderBy("timestamp", "desc")
            .get();

        const intakes = [];
        snapshot.forEach(doc => {
            intakes.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).json(intakes);
    } catch (error) {
        console.error("Error getting intakes:", error);
        res.status(500).send(error.message);
    }
});

// Example API to add a new intake
app.post("/intakes", async (req, res) => {
    try {
        const { patientId, dosage, timestamp } = req.body;

        if (!patientId || !dosage) {
            return res.status(400).send("Missing patientId or dosage");
        }

        const newIntake = {
            patientId,
            dosage,
            timestamp: timestamp ? admin.firestore.Timestamp.fromDate(new Date(timestamp)) : admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection("intakes").add(newIntake);
        res.status(201).json({ id: docRef.id, ...newIntake });
    } catch (error) {
        console.error("Error adding intake:", error);
        res.status(500).send(error.message);
    }
});

exports.api = functions.https.onRequest(app);
