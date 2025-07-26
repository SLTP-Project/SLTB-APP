// alert.js
import { auth } from './firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { db }   from './firebaseConfig.js';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// 1) Define loadNotifications at top‐level:
async function loadNotifications(userId) {
  const alertsBody  = document.getElementById("alerts-body");
  const noAlertsMsg = document.getElementById("no-alerts-msg");
  alertsBody.innerHTML = "";

  try {
    const notifCol = collection(db, "notifications");
    // Only filter by userId:
    const q = query(notifCol, where("userId", "==", userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      noAlertsMsg.textContent = "No notifications.";
      noAlertsMsg.style.display = "block";
      return;
    }
    noAlertsMsg.style.display = "none";

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const id   = docSnap.id;
      const message = data.message || "";
      const ts      = data.timestamp?.toDate();

      // Build your notification card here…
      const itemDiv = document.createElement("div");
      itemDiv.className = "alert-item";

      const textDiv = document.createElement("div");
      textDiv.className = "alert-text";
      textDiv.textContent = message;
      itemDiv.appendChild(textDiv);

      const tsDiv = document.createElement("div");
      tsDiv.className = "alert-timestamp";
      tsDiv.textContent = ts ? ts.toLocaleString() : "";
      itemDiv.appendChild(tsDiv);

      const delBtn = document.createElement("button");
      delBtn.className = "alert-delete-btn";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (!confirm("Delete this notification?")) return;
        await deleteDoc(doc(db, "notifications", id));
        itemDiv.remove();
        if (!alertsBody.querySelector(".alert-item")) {
          noAlertsMsg.textContent = "No notifications.";
          noAlertsMsg.style.display = "block";
        }
      });
      itemDiv.appendChild(delBtn);

      alertsBody.appendChild(itemDiv);
    });
  } catch (err) {
    console.error("Error loading notifications:", err);
    noAlertsMsg.textContent = "Error loading notifications.";
    noAlertsMsg.style.display = "block";
  }
}

// 2) Wait for DOM, then hook up drawer and auth
document.addEventListener("DOMContentLoaded", () => {
  // nav‐drawer toggle (unchanged)
  const menuBtn = document.getElementById("menu-btn");
  const navDrawer = document.getElementById("nav-drawer");
  if (menuBtn) menuBtn.addEventListener("click", () => navDrawer.classList.toggle("open"));
  document.addEventListener("click", e => {
    if (
      navDrawer &&
      !navDrawer.contains(e.target) &&
      menuBtn && !menuBtn.contains(e.target) &&
      navDrawer.classList.contains("open")
    ) navDrawer.classList.remove("open");
  });

  // 3) Now watch auth state
  onAuthStateChanged(auth, user => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    // finally load that user’s notifications
    loadNotifications(user.uid);
  });
});
