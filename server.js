const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const CryptoJS = require('crypto-js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const dotenv = require('dotenv');

dotenv.config();

// CORRECTED: Use Firebase Admin SDK credentials
const serviceAccount = {
  "type": process.env.FIREBASE_TYPE,
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": process.env.FIREBASE_AUTH_URI,
  "token_uri": process.env.FIREBASE_TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL,
  "universe_domain": process.env.FIREBASE_UNIVERSE_DOMAIN
};

try {
  initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  console.log('✅ Firebase Admin initialized successfully.');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error);
}

const db = getDatabase();

const SKILL_PAY_SECRET_KEY = process.env.SKILL_PAY_SECRET_KEY || "Qv0rg4oN8cS9sm6PS3rr6fu7MN2FB0Oo";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

// A simple GET route to avoid the 404 error
app.get('/', (req, res) => {
  res.status(200).send('Backend server is running!');
});

app.post('/api/callback', async (req, res) => {
  try {
    console.log("✅ Received callback from payment gateway:", req.body);

    const { encData } = req.body;
    if (!encData) {
      console.error("❌ No encrypted response data received.");
      return res.status(400).send("No encrypted data received.");
    }

    const key = CryptoJS.enc.Utf8.parse(SKILL_PAY_SECRET_KEY.padEnd(32, '0'));
    const iv = CryptoJS.enc.Utf8.parse(SKILL_PAY_SECRET_KEY.substring(0, 16));

    const decrypted = CryptoJS.AES.decrypt(encData, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const parsed = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    console.log("✅ Decryption successful:", parsed);

    const transactionRef = db.ref(`transactions/${parsed.CustRefNum}`);
    await transactionRef.set(parsed);
    console.log("✅ Decrypted data saved to Firebase.");

    // The payment gateway expects a 200 OK response, not a redirect.
    res.status(200).send('Transaction saved successfully.');

  } catch (err) {
    console.error("❌ Decryption failed:", err);
    res.status(500).send("Decryption failed.");
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
