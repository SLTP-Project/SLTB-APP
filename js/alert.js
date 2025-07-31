// js/alert.js
import { auth } from './firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { db } from './firebaseConfig.js';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let deleteMode = false;

// Custom confirmation popup (unchanged if you already have it)
function showPopup(message, onConfirm) {
  const popup = document.getElementById("confirm-popup");
  const msg = document.getElementById("popup-message");
  const cancelBtn = document.getElementById("popup-cancel");
  const confirmBtn = document.getElementById("popup-confirm");
  msg.textContent = message;
  popup.style.display = "flex";
  cancelBtn.onclick = () => popup.style.display = "none";
  confirmBtn.onclick = () => { popup.style.display = "none"; onConfirm(); };
}

async function loadNotifications(userId) {
  const alertsBody  = document.getElementById("alerts-body");
  const noAlertsMsg = document.getElementById("no-alerts-msg");
    const sound       = document.getElementById("notif-sound");
  alertsBody.innerHTML = "";

  try {
    const now = new Date();
    const notifCol = collection(db, "notifications");
    const q = query(notifCol, where("userId", "==", userId));
    const snap = await getDocs(q);

    // Filter: only show those whose timestamp ≤ now
    const docs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(n => n.timestamp?.toDate() <= now);

    if (docs.length === 0) {
      noAlertsMsg.textContent = "No notifications.";
      noAlertsMsg.style.display = "block";
      return;
    }
    noAlertsMsg.style.display = "none";
    // Render each notification
    docs.forEach(n => {
      const item = document.createElement("div");
      item.className = "alert-item";
      item.dataset.id = n.id;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "alert-checkbox";
      item.appendChild(cb);

      const text = document.createElement("div");
      text.className = "alert-text";
      text.textContent = n.message;
      item.appendChild(text);

      const ts = document.createElement("div");
      ts.className = "alert-timestamp";
      ts.textContent = n.timestamp.toDate().toLocaleString();
      item.appendChild(ts);

      alertsBody.appendChild(item);
    });

        // Play notification sound once
    if (sound && typeof sound.play === "function") {
      sound.currentTime = 0;
      sound.play().catch(_=>{/* user gesture may be required */});
    }
  } catch (err) {
    console.error("Error loading notifications:", err);
    const noAlertsMsg = document.getElementById("no-alerts-msg");
    noAlertsMsg.textContent = "Error loading notifications.";
    noAlertsMsg.style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-btn");
  const navDrawer = document.getElementById("nav-drawer");
  if (menuBtn) menuBtn.addEventListener("click", () => navDrawer.classList.toggle("open"));
  document.addEventListener("click", e => {
    if (navDrawer.contains(e.target) || menuBtn.contains(e.target)) return;
    if (navDrawer.classList.contains("open")) navDrawer.classList.remove("open");
  });

  const toggleBtn   = document.getElementById("toggle-delete-mode");
  const clearAllBtn = document.getElementById("clear-all-btn");
  const alertsBox   = document.getElementById("alerts-box");

  // Cancel delete mode on outside click
  document.addEventListener("click", e => {
    if (deleteMode &&
        !alertsBox.contains(e.target) &&
        !toggleBtn.contains(e.target) &&
        !clearAllBtn.contains(e.target)
    ) {
      deleteMode = false;
      alertsBox.classList.remove("delete-mode");
      clearAllBtn.style.display = "none";
      toggleBtn.textContent = "Delete";
    }
  });

  // Toggle delete mode / delete selected
  toggleBtn.addEventListener("click", () => {
    deleteMode = !deleteMode;
    if (deleteMode) {
      alertsBox.classList.add("delete-mode");
      clearAllBtn.style.display = "inline-block";
      toggleBtn.textContent = "Delete Selected";
      return;
    }
    const sel = document.querySelectorAll(".alert-checkbox:checked");
    if (sel.length === 0) {
      alertsBox.classList.remove("delete-mode");
      clearAllBtn.style.display = "none";
      toggleBtn.textContent = "Delete";
      return;
    }
    showPopup(`Delete ${sel.length} selected notifications?`, async () => {
      for (let cb of sel) {
        const id = cb.closest(".alert-item").dataset.id;
        await deleteDoc(doc(db, "notifications", id));
        cb.closest(".alert-item").remove();
      }
      deleteMode = false;
      alertsBox.classList.remove("delete-mode");
      clearAllBtn.style.display = "none";
      toggleBtn.textContent = "Delete";
    });
  });

  // Clear all visible
  clearAllBtn.addEventListener("click", () => {
    showPopup("Clear ALL notifications? This cannot be undone.", async () => {
      const boxes = document.querySelectorAll(".alert-checkbox");
      for (let cb of boxes) {
        const id = cb.closest(".alert-item").dataset.id;
        await deleteDoc(doc(db, "notifications", id));
        cb.closest(".alert-item").remove();
      }
      deleteMode = false;
      alertsBox.classList.remove("delete-mode");
      clearAllBtn.style.display = "none";
      toggleBtn.textContent = "Delete";
    });
  });

  // Auth & load
  onAuthStateChanged(auth, user => {
    if (!user) return window.location.href = 'index.html';
    loadNotifications(user.uid);
  });
});



//first coding when delete notification each box have each buttons
// // alert.js
// import { auth } from './firebaseConfig.js';
// import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
// import { db }   from './firebaseConfig.js';
// import {
//   collection,
//   query,
//   where,
//   getDocs,
//   deleteDoc,
//   doc
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// // 1) Define loadNotifications at top‐level:
// async function loadNotifications(userId) {
//   const alertsBody  = document.getElementById("alerts-body");
//   const noAlertsMsg = document.getElementById("no-alerts-msg");
//   alertsBody.innerHTML = "";

//   try {
//     const notifCol = collection(db, "notifications");
//     // Only filter by userId:
//     const q = query(notifCol, where("userId", "==", userId));
//     const snapshot = await getDocs(q);

//     if (snapshot.empty) {
//       noAlertsMsg.textContent = "No notifications.";
//       noAlertsMsg.style.display = "block";
//       return;
//     }
//     noAlertsMsg.style.display = "none";

//     snapshot.forEach(docSnap => {
//       const data = docSnap.data();
//       const id   = docSnap.id;
//       const message = data.message || "";
//       const ts      = data.timestamp?.toDate();

//       // Build your notification card here…
//       const itemDiv = document.createElement("div");
//       itemDiv.className = "alert-item";

//       const textDiv = document.createElement("div");
//       textDiv.className = "alert-text";
//       textDiv.textContent = message;
//       itemDiv.appendChild(textDiv);

//       const tsDiv = document.createElement("div");
//       tsDiv.className = "alert-timestamp";
//       tsDiv.textContent = ts ? ts.toLocaleString() : "";
//       itemDiv.appendChild(tsDiv);

//       const delBtn = document.createElement("button");
//       delBtn.className = "alert-delete-btn";
//       delBtn.textContent = "Delete";
//       delBtn.addEventListener("click", async () => {
//         if (!confirm("Delete this notification?")) return;
//         await deleteDoc(doc(db, "notifications", id));
//         itemDiv.remove();
//         if (!alertsBody.querySelector(".alert-item")) {
//           noAlertsMsg.textContent = "No notifications.";
//           noAlertsMsg.style.display = "block";
//         }
//       });
//       itemDiv.appendChild(delBtn);

//       alertsBody.appendChild(itemDiv);
//     });
//   } catch (err) {
//     console.error("Error loading notifications:", err);
//     noAlertsMsg.textContent = "Error loading notifications.";
//     noAlertsMsg.style.display = "block";
//   }
// }

// // 2) Wait for DOM, then hook up drawer and auth
// document.addEventListener("DOMContentLoaded", () => {
//   // nav‐drawer toggle (unchanged)
//   const menuBtn = document.getElementById("menu-btn");
//   const navDrawer = document.getElementById("nav-drawer");
//   if (menuBtn) menuBtn.addEventListener("click", () => navDrawer.classList.toggle("open"));
//   document.addEventListener("click", e => {
//     if (
//       navDrawer &&
//       !navDrawer.contains(e.target) &&
//       menuBtn && !menuBtn.contains(e.target) &&
//       navDrawer.classList.contains("open")
//     ) navDrawer.classList.remove("open");
//   });

//   // 3) Now watch auth state
//   onAuthStateChanged(auth, user => {
//     if (!user) {
//       window.location.href = 'index.html';
//       return;
//     }
//     // finally load that user’s notifications
//     loadNotifications(user.uid);
//   });
// });



