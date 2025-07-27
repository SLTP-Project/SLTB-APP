// // js/journey.js
// import { db } from './firebaseConfig.js';
// import {
//   collection,
//   query,
//   orderBy,
//   limit,
//   getDocs,
//   getDoc,
//   doc
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// const menuBtn = document.getElementById("menu-btn");
// const navDrawer = document.getElementById("nav-drawer");
// const vcodeInput = document.getElementById("vcode-input");
// const vcodeError = document.getElementById("vcode-error");
// const trackBtn = document.getElementById("track-journey-btn");
// const historyList = document.getElementById("history-list");

// // drawer
// menuBtn.addEventListener("click", () => navDrawer.classList.toggle("open"));
// document.addEventListener("click", e => {
//   if (!navDrawer.contains(e.target) &&
//       !menuBtn.contains(e.target) &&
//       navDrawer.classList.contains("open")) {
//     navDrawer.classList.remove("open");
//   }
// });

// // → Track Journey
// trackBtn.addEventListener("click", async () => {
//   vcodeError.textContent = "";
//   const v = vcodeInput.value.trim();
//   if (!v) {
//     return vcodeError.textContent = "Please enter your V‑Code.";
//   }
//   // verify it exists in Firestore
//   const snap = await getDoc(doc(db, "confirmedBookings", v));
//   if (!snap.exists()) {
//     return vcodeError.textContent = "V‑Code not found. Please check.";
//   }
//   // success → open tracker
//   window.location.href = `track.html?vcode=${encodeURIComponent(v)}`;

// });

// // → Load last 4 bookings
// async function loadHistory() {
//   historyList.innerHTML = `<p class="loading">Loading…</p>`;
//   try {
//     const q = query(
//       collection(db, "confirmedBookings"),
//       orderBy("timestamp","desc"),
//       limit(4)
//     );
//     const snap = await getDocs(q);
//     if (snap.empty) {
//       historyList.innerHTML = `<p class="loading">No past bookings.</p>`;
//       return;
//     }
//     historyList.innerHTML = "";
//     snap.forEach(d => {
//       const data = d.data();
//       const date = data.travelDate || "";
//       const from = data.from || "";
//       const to   = data.to   || "";
//       const item = document.createElement("div");
//       item.className = "history-item";
//       item.innerHTML = `
//         <span class="hist-date">${date}</span>
//         <div class="hist-route">
//           <img src="images/f.png" class="hist-icon" alt="From"/>
//           <span>${from}</span>
//           <span class="dashes">----</span>
//           <img src="images/t.png" class="hist-icon" alt="To"/>
//           <span>${to}</span>
//         </div>`;
//       historyList.appendChild(item);
//     });
//   } catch (e) {
//     console.error(e);
//     historyList.innerHTML = `<p class="loading">Error loading history.</p>`;
//   }
// }

// document.addEventListener("DOMContentLoaded", loadHistory);


// import { db } from './firebaseConfig.js';
// import {
//   collection,
//   query,
//   orderBy,
//   limit,
//   getDocs,
//   getDoc,
//   doc
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// const menuBtn     = document.getElementById("menu-btn");
// const navDrawer   = document.getElementById("nav-drawer");
// const vcodeInput  = document.getElementById("vcode-input");
// const vcodeError  = document.getElementById("vcode-error");
// const trackBtn    = document.getElementById("track-journey-btn");
// const historyList = document.getElementById("history-list");

// // Drawer toggle
// menuBtn.addEventListener("click", () => navDrawer.classList.toggle("open"));
// document.addEventListener("click", e => {
//   if (!navDrawer.contains(e.target) &&
//       !menuBtn.contains(e.target) &&
//       navDrawer.classList.contains("open")) {
//     navDrawer.classList.remove("open");
//   }
// });

// // → Track Journey (same‑tab redirect)
// trackBtn.addEventListener("click", async () => {
//   vcodeError.textContent = "";
//   const v = vcodeInput.value.trim();
//   if (!v) {
//     return vcodeError.textContent = "Please enter your V‑Code.";
//   }
//   const snap = await getDoc(doc(db, "confirmedBookings", v));
//   if (!snap.exists()) {
//     return vcodeError.textContent = "V‑Code not found. Please check.";
//   }
//   window.location.href = `track.html?vcode=${encodeURIComponent(v)}`;
// });

// // → Load last 4 bookings
// async function loadHistory() {
//   historyList.innerHTML = `<p class="loading">Loading…</p>`;
//   try {
//     const q = query(
//       collection(db, "confirmedBookings"),
//       orderBy("timestamp","desc"),
//       limit(4)
//     );
//     const snap = await getDocs(q);
//     if (snap.empty) {
//       return historyList.innerHTML = `<p class="loading">No past bookings.</p>`;
//     }
//     historyList.innerHTML = "";
//     snap.forEach(d => {
//       const { travelDate: date="", from="", to="" } = d.data();
//       const item = document.createElement("div");
//       item.className = "history-item";
//       item.innerHTML = `
//         <span class="hist-date">${date}</span>
//         <div class="hist-route">
//           <img src="images/f.png" class="hist-icon" alt="From"/>
//           <span>${from}</span>
//           <span class="dashes">----</span>
//           <img src="images/t.png" class="hist-icon" alt="To"/>
//           <span>${to}</span>
//         </div>`;
//       historyList.appendChild(item);
//     });
//   } catch (e) {
//     console.error(e);
//     historyList.innerHTML = `<p class="loading">Error loading history.</p>`;
//   }
// }

// document.addEventListener("DOMContentLoaded", loadHistory);

import { db } from './firebaseConfig.js';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const menuBtn      = document.getElementById("menu-btn");
const navDrawer    = document.getElementById("nav-drawer");
const vcodeInput   = document.getElementById("vcode-input");
const vcodeError   = document.getElementById("vcode-error");
const trackBtn     = document.getElementById("track-journey-btn");
const historyList  = document.getElementById("history-list");

// NAV drawer toggle
menuBtn.addEventListener("click", () => navDrawer.classList.toggle("open"));
document.addEventListener("click", e => {
  if (!navDrawer.contains(e.target) &&
      !menuBtn.contains(e.target) &&
      navDrawer.classList.contains("open")) {
    navDrawer.classList.remove("open");
  }
});

// → Track Journey button
trackBtn.addEventListener("click", async () => {
  vcodeError.textContent = "";
  const v = vcodeInput.value.trim();
  if (!v) {
    return vcodeError.textContent = "Please enter your V‑Code.";
  }
  // verify it exists
  const snap = await getDoc(doc(db, "confirmedBookings", v));
  if (!snap.exists()) {
    return vcodeError.textContent = "V‑Code not found. Please check.";
  }
  // same‑tab redirect
  window.location.href = `track.html?vcode=${encodeURIComponent(v)}`;
});

// → Load last 4 bookings into History
async function loadHistory() {
  historyList.innerHTML = `<p class="loading">Loading…</p>`;
  try {
    const q    = query(
      collection(db, "confirmedBookings"),
      orderBy("timestamp","desc"),
      limit(4)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      historyList.innerHTML = `<p class="loading">No past bookings.</p>`;
      return;
    }
    historyList.innerHTML = "";
    snap.forEach(d => {
      const data = d.data();
      const date = data.travelDate || "";
      const from = data.from       || "";
      const to   = data.to         || "";
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        <span class="hist-date">${date}</span>
        <div class="hist-route">
          <img src="images/f.png" class="hist-icon" alt="From"/>
          <span>${from}</span>
          <span class="dashes">----</span>
          <img src="images/t.png" class="hist-icon" alt="To"/>
          <span>${to}</span>
        </div>`;
      historyList.appendChild(item);
    });
  } catch (e) {
    console.error(e);
    historyList.innerHTML = `<p class="loading">Error loading history.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadHistory);
