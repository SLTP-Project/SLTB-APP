// js/final_info.js
import { auth } from './firebaseConfig.js';
import { db } from './firebaseConfig.js';
import {
  collection,
  addDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-btn");
  const navDrawer = document.getElementById("nav-drawer");
  const backBtn = document.getElementById("back-btn");
  const btnHome = document.getElementById("btn-home");
  const btnAlerts = document.getElementById("btn-alerts");
  const pickupEl = document.getElementById("fi-pickup");
  const dropEl = document.getElementById("fi-drop");

  // Toggle navigation drawer
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      navDrawer.classList.toggle("open");
    });
  }
  document.addEventListener("click", (e) => {
    if (
      navDrawer &&
      !navDrawer.contains(e.target) &&
      menuBtn &&
      !menuBtn.contains(e.target) &&
      navDrawer.classList.contains("open")
    ) {
      navDrawer.classList.remove("open");
    }
  });

  // Back button: go back to pickup_stop page
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "pickup_stop.html";
    });
  }

  // Home button
  if (btnHome) {
    btnHome.addEventListener("click", () => {
      window.location.href = "home.html";
    });
  }
  // Alerts button
  if (btnAlerts) {
    btnAlerts.addEventListener("click", () => {
      window.location.href = "alert.html";
    });
  }

  // Read pickup/drop from localStorage
  const pickupStop = localStorage.getItem("pickupStop") || "";
  const dropStop = localStorage.getItem("dropStop") || "";
  if (pickupEl) pickupEl.textContent = pickupStop || "--";
  if (dropEl) dropEl.textContent = dropStop || "--";

  // Send a greeting notification to Firestore under 'notifications' collection
  // requiring lastBookingVcode stored earlier
  async function sendGreetingNotification() {
    const vcode = localStorage.getItem("lastBookingVcode");
    if (!vcode) {
      console.warn("No lastBookingVcode; cannot send notification.");
      return;
    }
    // Compose message
    const message = `Your trip from "${pickupStop}" to "${dropStop}" is all set! We'll notify you when bus is near your stops.`;
    try {
      // Save to Firestore: collection "notifications", with fields:
      // bookingId: vcode, message, timestamp. You can also include user email if available.
      const colRef = collection(db, "notifications");
      await addDoc(colRef, {
        bookingId: vcode,
        userId: auth.currentUser.uid,
        message: message,
        timestamp: Timestamp.now()
      });
      console.log("Greeting notification saved.");
    } catch (err) {
      console.error("Error saving notification:", err);
    }
  }

  sendGreetingNotification();
  async function sendGreetingNotification() {
  const vcode = localStorage.getItem("lastBookingVcode");
  if (!vcode) {
    console.warn("No lastBookingVcode; cannot send notification.");
    return;
  }
  const message = `Your trip from "${pickupStop}" to "${dropStop}" is all set! ...`;
  try {
    const colRef = collection(db, "notifications");
    const docRef = await addDoc(colRef, {
      bookingId: vcode,
      userId: auth.currentUser.uid,
      message: message,
      timestamp: Timestamp.now()
    });
    console.log("Greeting notification saved, id=", docRef.id);
  } catch (err) {
    console.error("Error saving notification:", err);
  }
}

});
