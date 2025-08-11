const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const CryptoJS = require('crypto-js');
const dotenv = require('dotenv');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');

dotenv.config();

const app = express();
const PORT = 5000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({ origin: 'http://localhost:3000' }));

// Initialize Firebase with your project's configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const SKILL_PAY_SECRET_KEY = process.env.SKILL_PAY_SECRET_KEY; // Your AuthKey from .env

// A new endpoint for handling the seamless payment callback
app.post('/api/callback', async (req, res) => {
    try {
        console.log("✅ Received callback from payment gateway:", req.body);

        // CORRECTED: The payment gateway sends the encrypted data in a field named 'encData'
        const { encData } = req.body;

        if (!encData) {
            console.error("❌ No encrypted response data received.");
            return res.status(400).send("No encrypted response data received.");
        }
        
        // Use CryptoJS to decrypt, matching your frontend
        const key = CryptoJS.enc.Utf8.parse(SKILL_PAY_SECRET_KEY.padEnd(32, '0'));
        const iv = CryptoJS.enc.Utf8.parse(SKILL_PAY_SECRET_KEY.substring(0, 16));

        const decrypted = CryptoJS.AES.decrypt(encData, key, {
            iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        
        const parsed = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
        console.log("✅ Decryption successful:", parsed);

        // Save the decrypted data to Firebase
        const transactionRef = ref(db, `transactions/${parsed.CustRefNum}`);
        await set(transactionRef, parsed);
        console.log("✅ Decrypted data saved to Firebase.");

        // The payment gateway expects a 200 OK response to confirm the callback was received.
        // We also redirect the user to the transaction page to display the QR code.
        const redirectUrl = `http://localhost:3000/transaction?custRefNum=${parsed.CustRefNum}`;
        res.redirect(302, redirectUrl);

    } catch (err) {
        console.error("❌ Decryption failed:", err);
        // Respond with an error to the payment gateway
        res.status(500).send("Decryption failed.");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
