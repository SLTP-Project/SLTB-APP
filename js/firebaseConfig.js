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



import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth }      from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getDatabase }  from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCL_pqvzUJMNlWpankZHnJzOEQqR1IShZM",
  authDomain: "sltb-e-seat.firebaseapp.com",
  databaseURL: "https://sltb-e-seat-default-rtdb.asia-southeast1.firebasedatabase.app",  // ← add this
  projectId: "sltb-e-seat",
  storageBucket: "sltb-e-seat.firebasestorage.app",
  messagingSenderId: "598552204337",
  appId: "1:598552204337:web:28ec5ab113ecce5cf0b110",
  measurementId: "G-XQ2NDGQ4PM"
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
export const dbRT = getDatabase(app);  // ← initialize RTDB too
