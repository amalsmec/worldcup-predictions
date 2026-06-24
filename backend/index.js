const functions = require('firebase-functions');
const app = require('./server');

// Expose Express App as a Firebase Cloud Function
exports.api = functions.https.onRequest(app);
