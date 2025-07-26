const functions = require("firebase-functions");
const admin     = require("firebase-admin");
admin.initializeApp();

exports.deliverNotifications = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async (ctx) => {
    const now = admin.firestore.Timestamp.now();
    const snap = await admin.firestore()
      .collection("notifications")
      .where("delivered", "==", false)
      .where("timestamp", "<=", now)
      .get();

    if (snap.empty) return null;
    const batch = admin.firestore().batch();
    snap.forEach(doc => batch.update(doc.ref, { delivered: true }));
    return batch.commit();
  });
