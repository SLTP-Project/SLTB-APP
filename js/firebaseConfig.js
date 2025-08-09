// // js/firebaseConfig.js
// // This file is a module that initializes Firebase and exports Firestore (db).

// import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
// import { getAuth }      from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
// import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// // TODO: Replace with your actual Firebase config (you already have these from your console)
// const firebaseConfig = {
//   apiKey: "AIzaSyCL_pqvzUJMNlWpankZHnJzOEQqR1IShZM",
//   authDomain: "sltb-e-seat.firebaseapp.com",
//   projectId: "sltb-e-seat",
//   storageBucket: "sltb-e-seat.firebasestorage.app",
//   messagingSenderId: "598552204337",
//   appId: "1:598552204337:web:28ec5ab113ecce5cf0b110",
//   measurementId: "G-XQ2NDGQ4PM"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);

// // Initialize Firestore
// export const db = getFirestore(app);
// export const auth = getAuth(app);

// import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
// import { getAuth }      from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
// import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// const firebaseConfig = {
//   apiKey: "AIzaSyCL_pqvzUJMNlWpankZHnJzOEQqR1IShZM",
//   authDomain: "sltb-e-seat.firebaseapp.com",
//   projectId: "sltb-e-seat",
//   storageBucket: "sltb-e-seat.firebasestorage.app",
//   messagingSenderId: "598552204337",
//   appId: "1:598552204337:web:28ec5ab113ecce5cf0b110",
//   measurementId: "G-XQ2NDGQ4PM"
// };

// export const app = initializeApp(firebaseConfig);  // <-- Export app
// export const db = getFirestore(app);
// export const auth = getAuth(app);



// import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
// import { getAuth }      from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
// import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
// import { getDatabase }  from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

// const firebaseConfig = {
//   apiKey: "AIzaSyCL_pqvzUJMNlWpankZHnJzOEQqR1IShZM",
//   authDomain: "sltb-e-seat.firebaseapp.com",
//   databaseURL: "https://sltb-e-seat-default-rtdb.asia-southeast1.firebasedatabase.app",  // ← add this
//   projectId: "sltb-e-seat",
//   storageBucket: "sltb-e-seat.firebasestorage.app",
//   messagingSenderId: "598552204337",
//   appId: "1:598552204337:web:28ec5ab113ecce5cf0b110",
//   measurementId: "G-XQ2NDGQ4PM"
// };

// export const app  = initializeApp(firebaseConfig);
// export const db   = getFirestore(app);
// export const auth = getAuth(app);
// export const dbRT = getDatabase(app);  // ← initialize RTDB too



// /*
//   GPS APP (ESP32) - second Firebase project that the GPS writes to.
//   Replace the databaseURL below with the exact DB URL that your ESP32 writes to (sltb-20c0a).
// */
// const busConfig = {
//   apiKey: "AIzaSyAC5J_QdGrFdOVpon8dXxIm62xHLqZRK1o", // optional but harmless
//   authDomain: "sltb-20c0a.firebaseapp.com",
//   databaseURL: "https://sltb-20c0a-default-rtdb.firebaseio.com",
//   projectId: "sltb-20c0a",
//   storageBucket: "sltb-20c0a.firebasestorage.app",
//   messagingSenderId: "395704643902",
//   appId: "1:395704643902:web:6e539492af07f5d4947c6f",
//   measurementId: "G-EFNH10JYBF"
// };

// // initialize a second, named app for the bus GPS DB
// export const busApp = initializeApp(busConfig, "busApp");
// export const busDbRT = getDatabase(busApp);

// /*
//   Optional: sign in anonymously to busApp (useful if the GPS DB requires auth).
//   Enable Anonymous auth in the GPS project's Firebase Console if you want this to work.
// */
// try {
//   const busAuth = getAuth(busApp);
//   signInAnonymously(busAuth)
//     .then(() => console.log("Anonymous sign-in to busApp succeeded"))
//     .catch(err => console.warn("busApp anonymous sign-in failed:", err?.message || err));
// } catch (e) {
//   console.warn("busApp anonymous sign-in threw:", e?.message || e);
// }




// // js/firebaseConfig.js
// import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
// import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
// import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
// import { getDatabase } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

// /* MAIN app (your web app: sltb-e-seat) */
// const firebaseConfig = {
//   apiKey: "AIzaSyCL_pqvzUJMNlWpankZHnJzOEQqR1IShZM",
//   authDomain: "sltb-e-seat.firebaseapp.com",
//   databaseURL: "https://sltb-e-seat-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "sltb-e-seat",
//   storageBucket: "sltb-e-seat.firebasestorage.app",
//   messagingSenderId: "598552204337",
//   appId: "1:598552204337:web:28ec5ab113ecce5cf0b110",
//   measurementId: "G-XQ2NDGQ4PM"
// };

// export const app  = initializeApp(firebaseConfig);
// export const db   = getFirestore(app);
// export const auth = getAuth(app);
// export const dbRT = getDatabase(app); // default RTDB (sltb-e-seat)

// console.log("Main Firebase app initialized (sltb-e-seat)", { name: app.name, databaseURL: firebaseConfig.databaseURL });

// /* BUS/GPS app (ESP32 writes here) — sltb-20c0a */
// const busConfig = {
//   apiKey: "AIzaSyAC5J_QdGrFdOVpon8dXxIm62xHLqZRK1o",
//   authDomain: "sltb-20c0a.firebaseapp.com",
//   databaseURL: "https://sltb-20c0a-default-rtdb.firebaseio.com",
//   projectId: "sltb-20c0a",
//   storageBucket: "sltb-20c0a.firebasestorage.app",
//   messagingSenderId: "395704643902",
//   appId: "1:395704643902:web:6e539492af07f5d4947c6f",
//   measurementId: "G-EFNH10JYBF"
// };

// export const busApp = initializeApp(busConfig, "busApp");
// export const busDbRT = getDatabase(busApp);

// console.log("Bus Firebase app initialized (sltb-20c0a)", { name: busApp.name, databaseURL: busConfig.databaseURL });

// // Try anonymous sign-in on busApp so SDK listeners work if DB rules require auth.
// // Enable Anonymous Auth in the sltb-20c0a Firebase Console if needed.
// try {
//   const busAuth = getAuth(busApp);
//   signInAnonymously(busAuth)
//     .then(() => console.log("Signed into busApp anonymously"))
//     .catch(err => console.warn("busApp anonymous sign-in failed:", err?.message || err));
// } catch (e) {
//   console.warn("busApp sign-in try/catch error:", e?.message || e);
// }




// js/firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

/* MAIN app (your web app: sltb-e-seat) */
const firebaseConfig = {
  apiKey: "AIzaSyCL_pqvzUJMNlWpankZHnJzOEQqR1IShZM",
  authDomain: "sltb-e-seat.firebaseapp.com",
  databaseURL: "https://sltb-e-seat-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sltb-e-seat",
  storageBucket: "sltb-e-seat.firebasestorage.app",
  messagingSenderId: "598552204337",
  appId: "1:598552204337:web:28ec5ab113ecce5cf0b110",
  measurementId: "G-XQ2NDGQ4PM"
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
export const dbRT = getDatabase(app); // default RTDB (sltb-e-seat)

console.log("Main Firebase app initialized (sltb-e-seat)", { name: app.name, databaseURL: firebaseConfig.databaseURL });

/* BUS/GPS app (ESP32 writes here) — sltb-20c0a */
const busConfig = {
  apiKey: "AIzaSyAC5J_QdGrFdOVpon8dXxIm62xHLqZRK1o",
  authDomain: "sltb-20c0a.firebaseapp.com",
  databaseURL: "https://sltb-20c0a-default-rtdb.firebaseio.com",
  projectId: "sltb-20c0a",
  storageBucket: "sltb-20c0a.firebasestorage.app",
  messagingSenderId: "395704643902",
  appId: "1:395704643902:web:6e539492af07f5d4947c6f",
  measurementId: "G-EFNH10JYBF"
};

export const busApp = initializeApp(busConfig, "busApp");
export const busDbRT = getDatabase(busApp);

console.log("Bus Firebase app initialized (sltb-20c0a)", { name: busApp.name, databaseURL: busConfig.databaseURL });

// Try anonymous sign-in on busApp so SDK listeners work if DB rules require auth.
// Enable Anonymous Auth in the sltb-20c0a Firebase Console if needed.
export async function ensureBusAuth() {
  try {
    const busAuth = getAuth(busApp);
    // watch auth state and attempt sign-in if unknown
    return new Promise((resolve) => {
      onAuthStateChanged(busAuth, (user) => {
        if (user) {
          console.log("busApp: already signed in:", user.uid);
          resolve(true);
        } else {
          signInAnonymously(busAuth)
            .then(() => {
              console.log("Signed into busApp anonymously");
              resolve(true);
            })
            .catch(err => {
              console.warn("busApp anonymous sign-in failed:", err?.message || err);
              // still resolve false so caller can fallback or inform user
              resolve(false);
            });
        }
      }, (err) => {
        console.warn("onAuthStateChanged error:", err);
        resolve(false);
      });
    });
  } catch (e) {
    console.warn("busApp sign-in try/catch error:", e?.message || e);
    return false;
  }
}
