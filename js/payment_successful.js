// js/payment_successful.js
import { auth } from './firebaseConfig.js';
import { db } from './firebaseConfig.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Drawer toggle (unchanged)
const menuBtn = document.getElementById("menu-btn");
const navDrawer = document.getElementById("nav-drawer");
if (menuBtn) {
  menuBtn.addEventListener("click", () => navDrawer.classList.toggle("open"));
}
document.addEventListener("click", e => {
  if (!navDrawer.contains(e.target) &&
      !menuBtn.contains(e.target) &&
      navDrawer.classList.contains("open")) {
    navDrawer.classList.remove("open");
  }
});

// Primary & secondary buttons (unchanged)
document.getElementById("see-journey-btn")
  .addEventListener("click", () => window.location.href = "pickup_stop.html");
document.getElementById("skip-home-btn")
  .addEventListener("click", () => window.location.href = "home.html");

// Download receipt (unchanged)
const downloadBtn = document.getElementById("download-image-btn");
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    const box = document.querySelector(".success-box");
    if (!box) return;
    html2canvas(box).then(canvas => {
      const link = document.createElement("a");
      link.download = `sltb_booking_${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Read pendingBooking
  const pendingStr = localStorage.getItem("pendingBooking");
  if (!pendingStr) return console.warn("No pendingBooking");
  let pb;
  try { pb = JSON.parse(pendingStr); }
  catch (e) { localStorage.removeItem("pendingBooking"); return; }

  const { route, date, from, to, seats, departureTime, personal, paymentMethod, cardLast4 } = pb;
  if (!route||!date||!from||!to||!seats?.length||!personal||!paymentMethod) return;

  // 2. Update seat availability (unchanged)
  const docId = `${route}_${date}`;
  const bookingDocRef = doc(db, 'bookings', docId);
  try {
    const snap = await getDoc(bookingDocRef);
    if (snap.exists()) {
      await updateDoc(bookingDocRef, { seats: arrayUnion(...seats) });
    } else {
      await setDoc(bookingDocRef, { seats });
    }
  } catch (e) {
    console.error("Seat avail update err:", e);
  }

  // 3. Write detailed booking + generate V-Code
  let vcode = null;
  try {
    const colRef = collection(db, "confirmedBookings");
    const bookingData = {
      route, from, to,
      travelDate: date,
      departureTime: departureTime || null,
      seats,
      personal,            // { name, mobile, nic, email }
      paymentMethod,
      cardLast4: cardLast4 || null,
      timestamp: new Date()
    };
    const { id } = await addDoc(colRef, bookingData);
    vcode = id;
    localStorage.setItem("lastBookingVcode", vcode);
  } catch (e) {
    console.error("Detailed booking err:", e);
  }

  // 4. Populate your page fields (unchanged)
  document.getElementById("ps-seat").textContent = seats.join(", ");
  document.getElementById("ps-deport").textContent = to;
  document.getElementById("ps-route").textContent = `${from} – ${to}`;
  document.getElementById("ps-date").textContent = date;
  document.getElementById("ps-time").textContent = departureTime || "";
  document.getElementById("ps-payment-method").textContent =
    paymentMethod.toLowerCase() === "visa" ? "Visa card"
    : paymentMethod.toLowerCase() === "mastercard" ? "Mastercard"
    : paymentMethod;
  document.getElementById("ps-vcode").textContent = vcode || "";

  // 5. Clear pending
  localStorage.removeItem("pendingBooking");

  // 6. Immediate “payment successful” notification
  try {
    await addDoc(collection(db, "notifications"), {
      userId: auth.currentUser.uid,
      message: `Payment successful! V-Code: ${vcode}. Route ${from}→${to} on ${date} at ${departureTime}.`,
      timestamp: new Date(),      // immediate deliver
      bookingId: vcode
    });
  } catch (e) { console.error("Payment notif err:", e); }

  // 7. Greeting notification
  try {
    await addDoc(collection(db, "notifications"), {
      userId: auth.currentUser.uid,
      message: `Your trip from "${from}" to "${to}" is confirmed!`,
      timestamp: new Date(),
      bookingId: vcode
    });
  } catch (e) { console.error("Greeting notif err:", e); }

  // 8. Time-based reminders
  if (departureTime) {
    const [hh, mm] = departureTime.split(":").map(s => s.padStart(2, '0'));
    const dep = new Date(`${date}T${hh}:${mm}:00`);
    const tenBefore = new Date(dep.getTime() - 10 * 60 * 1000);

    // 10-min before
    try {
      await addDoc(collection(db, "notifications"), {
        userId: auth.currentUser.uid,
        message: `Reminder: Bus from ${from} to ${to} departs in 10 minutes.`,
        timestamp: tenBefore,
        bookingId: vcode
      });
    } catch (e) { console.error("Ten-min notif err:", e); }

    // At departure
    try {
      await addDoc(collection(db, "notifications"), {
        userId: auth.currentUser.uid,
        message: `Your bus from ${from} to ${to} is departing now. Safe travels!`,
        timestamp: dep,
        bookingId: vcode
      });
    } catch (e) { console.error("Depart-time notif err:", e); }
  }
});


//old correct code 

// // js/payment_successful.js
// import { auth } from './firebaseConfig.js';
// import { db } from './firebaseConfig.js';
// import {
//   doc,
//   getDoc,
//   setDoc,
//   updateDoc,
//   arrayUnion,
//   collection,
//   addDoc
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// // Drawer toggle
// const menuBtn = document.getElementById("menu-btn");
// const navDrawer = document.getElementById("nav-drawer");
// if (menuBtn) {
//   menuBtn.addEventListener("click", () => navDrawer.classList.toggle("open"));
// }
// document.addEventListener("click", e => {
//   if (!navDrawer.contains(e.target) &&
//       !menuBtn.contains(e.target) &&
//       navDrawer.classList.contains("open")) {
//     navDrawer.classList.remove("open");
//   }
// });

// // No back button in header per requirement

// // Primary action → e.g. Set location alarm (user-defined)
// const seeJourneyBtn = document.getElementById("see-journey-btn");
// if (seeJourneyBtn) {
//   seeJourneyBtn.addEventListener("click", () => {
//     // Redirect or handle as needed
//     window.location.href = "pickup_stop.html";
//   });
// }
// // Secondary action → home.html
// const skipHomeBtn = document.getElementById("skip-home-btn");
// if (skipHomeBtn) {
//   skipHomeBtn.addEventListener("click", () => {
//     window.location.href = "home.html";
//   });
// }

// // Bottom nav highlight & navigation
// document.querySelectorAll(".nav-item-bottom").forEach(item =>
//   item.addEventListener("click", () => {
//     document.querySelectorAll(".nav-item-bottom").forEach(el => el.classList.remove("active"));
//     item.classList.add("active");
//     const label = item.querySelector(".nav-label-bottom")?.textContent.trim();
//     if (label === "Journey") {
//       window.location.href = "journey.html";
//     } else if (label === "Home") {
//       window.location.href = "home.html";
//     } else if (label === "Alert") {
//       window.location.href = "alert.html";
//     } else if (label === "Account") {
//       window.location.href = "account.html";
//     }
//   })
// );

// document.addEventListener("DOMContentLoaded", async () => {
//   // Read pendingBooking from localStorage
//   const pendingStr = localStorage.getItem("pendingBooking");
//   if (!pendingStr) {
//     console.warn("No pendingBooking found in localStorage.");
//     return;
//   }
//   let pendingBooking;
//   try {
//     pendingBooking = JSON.parse(pendingStr);
//   } catch (e) {
//     console.error("Error parsing pendingBooking:", e);
//     localStorage.removeItem("pendingBooking");
//     return;
//   }
//   const { route, date, from, to, seats, departureTime, personal, paymentMethod } = pendingBooking;
//   if (!route || !date || !from || !to || !Array.isArray(seats) || seats.length === 0
//       || !personal || !paymentMethod) {
//     console.warn("Incomplete pendingBooking data:", pendingBooking);
//     localStorage.removeItem("pendingBooking");
//     return;
//   }

//   // 1. Commit seat availability to 'bookings' collection as before:
//   const docId = `${route}_${date}`;
//   const bookingDocRef = doc(db, 'bookings', docId);
//   try {
//     const snap = await getDoc(bookingDocRef);
//     if (snap.exists()) {
//       // Append seats atomically
//       await updateDoc(bookingDocRef, {
//         seats: arrayUnion(...seats)
//       });
//     } else {
//       // Create new doc
//       await setDoc(bookingDocRef, {
//         seats: seats
//       });
//     }
//     console.log("Seat availability updated in 'bookings':", docId, seats);
//   } catch (err) {
//     console.error("Error updating seat availability:", err);
//     // You may choose to alert user, but proceed to store detailed booking anyway.
//   }

//   // 2. Commit full booking details to a separate collection, e.g. "confirmedBookings"
//   //    so admin can view personal details etc.
//   let vcode = null;
//   try {
//     const colRef = collection(db, "confirmedBookings");
//     // Build booking document
//     const bookingData = {
//       route: route,
//       from: from,
//       to: to,
//       travelDate: date, // "YYYY-MM-DD"
//       departureTime: departureTime || null,
//       seats: seats,
//       personal: personal, // { name, mobile, nic, email }
//       paymentMethod: paymentMethod, // "visa" or "mastercard"
//       cardLast4: pendingBooking.cardLast4 || null,
//       timestamp: new Date()
//     };
//     const docRef = await addDoc(colRef, bookingData);
//     vcode = docRef.id; // Firestore-generated ID as V-Code
//     localStorage.setItem("lastBookingVcode", vcode);
//     console.log("Detailed booking written to 'confirmedBookings' with ID:", vcode);
//   } catch (err) {
//     console.error("Error writing detailed booking:", err);
//   }

//   // 3. Populate the page fields:
//   // Seat no
//   const seatEl = document.getElementById("ps-seat");
//   if (seatEl) seatEl.textContent = seats.join(", ");
//   // Deport = 'to' location
//   const deportEl = document.getElementById("ps-deport");
//   if (deportEl) deportEl.textContent = to;
//   // Route = from – to
//   const routeEl = document.getElementById("ps-route");
//   if (routeEl) routeEl.textContent = `${from} – ${to}`;
//   // Travel date
//   const dateEl = document.getElementById("ps-date");
//   if (dateEl) dateEl.textContent = date;
//   // Time (departureTime)
//   const timeEl = document.getElementById("ps-time");
//   if (timeEl) timeEl.textContent = departureTime || "";
//   // Mode of payment: show proper label
//   const pmEl = document.getElementById("ps-payment-method");
//   if (pmEl) {
//     let text = "";
//     if (paymentMethod.toLowerCase() === "visa") {
//       text = "Visa card";
//     } else if (paymentMethod.toLowerCase() === "mastercard") {
//       text = "Mastercard";
//     } else {
//       text = paymentMethod;
//     }
//     pmEl.textContent = text;
//   }
//   // V-Code
//   const vcodeEl = document.getElementById("ps-vcode");
//   if (vcodeEl) vcodeEl.textContent = vcode || "";

//   // Clear pendingBooking now that booking is confirmed
//   localStorage.removeItem("pendingBooking");
//   localStorage.setItem("lastBookingVcode", vcode);
//   console.log("Saved lastBookingVcode:", vcode);

//   // Also immediately write greeting notification:
// try {
//   const notifCol = collection(db, "notifications");
//   const message = `Your trip from "${from}" to "${to}" is all set! We'll notify you when bus is near your stops.`;
//   await addDoc(notifCol, {
//     bookingId: vcode,
//     userId: auth.currentUser.uid,
//     message,
//     timestamp: new Date()
//   });
//   console.log("Greeting notification saved in payment_successful.js");
// } catch(err) {
//   console.error("Error saving greeting notification in payment_successful.js:", err);
// }

// // Add travel start notifications (10 minutes before and exact time)
// try {
//   const notifCol = collection(db, "notifications");

//   // Parse date and time into JS Date object
//   const [hourStr, minuteStr] = (departureTime || "00:00").split(":");
//   const depDate = new Date(`${date}T${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}:00`);

//   // Notification 10 minutes before
//   const tenMinBefore = new Date(depDate.getTime() - 10 * 60 * 1000);
//   await addDoc(notifCol, {
//     bookingId: vcode,
//     userId: auth.currentUser.uid,
//     message: `Reminder: Your bus from ${from} to ${to} departs in 10 minutes.`,
//     timestamp: tenMinBefore,
//      delivered: false ,
//   });

//   // Notification at departure time
//   await addDoc(notifCol, {
//     bookingId: vcode,
//     userId: auth.currentUser.uid,
//     message: `Your bus from ${from} to ${to} has now departed. Safe travels!`,
//     timestamp: depDate,
//     delivered: false 
//   });

//   console.log("Travel notifications scheduled.");
// } catch (err) {
//   console.error("Error scheduling travel notifications:", err);
// }

// // for download as image 
// const downloadBtn = document.getElementById("download-image-btn");
// if (downloadBtn) {
//   downloadBtn.addEventListener("click", () => {
//     const box = document.querySelector(".success-box");
//     if (!box) return;

//     html2canvas(box).then(canvas => {
//       const link = document.createElement("a");
//       link.download = `sltb_booking_${new Date().toISOString().split("T")[0]}.png`;
//       link.href = canvas.toDataURL();
//       link.click();
//     });
//   });
// }


// });
