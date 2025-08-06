// js/track.js
import { app, db, dbRT } from "./firebaseConfig.js";
import {
  doc, getDoc, setDoc, onSnapshot, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
  ref as rtdbRef, query, limitToLast, onChildAdded
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

let map;
let liveUserMarker = null;
let busMarker = null;
let busListener = null;
let busRouteRenderer = null;
let fromLoc, toLoc;
let watchId = null;
let isTrackingLive = false;

function getClientId() {
  let id = localStorage.getItem("clientId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("clientId", id);
  }
  return id;
}

const clientId = getClientId();
const urlParams = new URLSearchParams(window.location.search);
const vcode = urlParams.get("vcode");

window.onload = initMap;

async function initMap() {
  // Initialize the Google Map
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: { lat: 7.8731, lng: 80.7718 },
    fullscreenControl: false,
    streetViewControl: false,
  });

  if (!vcode) {
    alert("No V-Code provided.");
    return;
  }

  // Fetch booking info from Firestore
  const bookingRef = doc(db, "confirmedBookings", vcode);
  const snap = await getDoc(bookingRef);
  if (!snap.exists()) {
    alert("Booking not found.");
    return;
  }

  const { from, to, route, activeTracker } = snap.data();
  document.getElementById("header-info").textContent =
    `Bus #${route} • ${from} → ${to}`;

  // Geocode pickup and drop locations
  const geocoder = new google.maps.Geocoder();
  [fromLoc, toLoc] = await Promise.all(
    ["from", "to"].map(key => new Promise(res => {
      geocoder.geocode({ address: snap.data()[key] }, (results, status) => {
        res(status === "OK" ? results[0].geometry.location : null);
      });
    }))
  );
  if (!fromLoc || !toLoc) {
    alert("Couldn’t geocode stops.");
    return;
  }

  // Place pickup and drop markers
  new google.maps.Marker({
    map,
    position: fromLoc,
    icon: { url: "images/f.png", scaledSize: new google.maps.Size(32,32) },
    title: "Pickup"
  });
  new google.maps.Marker({
    map,
    position: toLoc,
    icon: { url: "images/t.png", scaledSize: new google.maps.Size(32,32) },
    title: "Drop"
  });

  // Fit route bounds
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(fromLoc);
  bounds.extend(toLoc);
  map.fitBounds(bounds, 100);
  document.getElementById("info-bar").textContent = `${from} → ${to}`;

  // Draw the route line
  const directionsService = new google.maps.DirectionsService();
  busRouteRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    polylineOptions: { strokeColor: "#ff6b00", strokeWeight: 6 }
  });
  directionsService.route({
    origin: fromLoc,
    destination: toLoc,
    travelMode: google.maps.TravelMode.DRIVING
  }, (result, status) => {
    if (status === "OK") {
      busRouteRenderer.setDirections(result);
    }
  });

  // Set up buttons
  const startBtn = document.getElementById("btn-start-journey");
  const liveBtn  = document.getElementById("btn-track-live");
  const busBtn   = document.getElementById("btn-track-bus");

  // Handle exclusive tracker assignment
  if (!activeTracker) {
    startBtn.style.display = "block";
    liveBtn.style.display  = "none";
    startBtn.addEventListener("click", async () => {
      await setDoc(bookingRef, { activeTracker: clientId }, { merge: true });
      startBtn.style.display = "none";
      liveBtn.style.display  = "block";
    });
  } else if (activeTracker === clientId) {
    startBtn.style.display = "none";
    liveBtn.style.display  = "block";
  } else {
    startBtn.style.display = "none";
    liveBtn.style.display  = "none";
    subscribeToLive(activeTracker);
  }

  // Toggle publishing of user's live location
  liveBtn.addEventListener("click", async () => {
    if (!isTrackingLive) {
      const allowed = await requestLocationPermission();
      if (allowed) {
        liveBtn.textContent = "Stop Live Tracking";
      }
    } else {
      stopPublishing();
      await updateDoc(bookingRef, { activeTracker: null });
      liveBtn.textContent = "Track My Live Location";
    }
  });

  // Bus tracking: show/hide live bus marker
  busBtn.addEventListener("click", () => {
    if (busListener) {
      busListener();
      busListener = null;
      busMarker?.setMap(null);
      busMarker = null;
      busBtn.textContent = "Track Bus";
    } else {
      const historyRef = rtdbRef(dbRT, "/LocationHistory");
      const historyQuery = query(historyRef, limitToLast(1));

      // Realtime updates for new GPS points
      busListener = onChildAdded(historyQuery, snapshot => {
        const { Latitude: lat, Longitude: lng } = snapshot.val() || {};
        console.log("New bus location data:", snapshot.val());
        if (lat == null || lng == null) return;

        const pos = new google.maps.LatLng(lat, lng);
        if (!busMarker) {
          busMarker = new google.maps.Marker({
            map,
            position: pos,
            icon: { url: "images/bus.png", scaledSize: new google.maps.Size(42,42) },
            title: "Live Bus Location"
          });
          map.setZoom(12);
          map.panTo(pos);
        } else {
          animateMarker(busMarker, pos, 1000); // Animate over 1s
        }
      });

      busBtn.textContent = "Stop Tracking Bus";
    }
  });
}

// Animate marker between two points
function animateMarker(marker, newPosition, duration) {
  const oldPosition = marker.getPosition();
  const start = performance.now();

  function step(timestamp) {
    const progress = Math.min((timestamp - start) / duration, 1);
    const lat = oldPosition.lat() + (newPosition.lat() - oldPosition.lat()) * progress;
    const lng = oldPosition.lng() + (newPosition.lng() - oldPosition.lng()) * progress;
    marker.setPosition(new google.maps.LatLng(lat, lng));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  map.panTo(newPosition);
}

// NEW: Check location permission & show guide if denied
async function requestLocationPermission() {
  try {
    const permission = await navigator.permissions.query({ name: "geolocation" });
    if (permission.state === "granted") {
      beginPublishing();
      return true;
    } else if (permission.state === "prompt") {
      beginPublishing(); // Will show prompt
      return true;
    } else if (permission.state === "denied") {
      showLocationDeniedModal();
      return false;
    }
  } catch (err) {
    console.error("Permission check error:", err);
    beginPublishing();
    return true;
  }
}

// Start publishing user location
function beginPublishing() {
  isTrackingLive = true;
  let firstUpdate = true;
  watchId = navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const liveRef = doc(db, "confirmedBookings", vcode, "liveLocations", clientId);
    setDoc(liveRef, { lat, lng, ts: serverTimestamp() });
    const latlng = new google.maps.LatLng(lat, lng);
    if (!liveUserMarker) {
      liveUserMarker = new google.maps.Marker({
        map,
        position: latlng,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#d50000",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2
        },
        title: "My Live Location"
      });
    } else {
      liveUserMarker.setPosition(latlng);
    }
    if (firstUpdate) {
      map.panTo(latlng);
      firstUpdate = false;
    }
  }, err => console.warn(err), { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 });
}

function stopPublishing() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  liveUserMarker?.setMap(null);
  liveUserMarker = null;
  isTrackingLive = false;
}

function subscribeToLive(trackerId) {
  const liveRef = doc(db, "confirmedBookings", vcode, "liveLocations", trackerId);
  onSnapshot(liveRef, snap => {
    if (!snap.exists()) return;
    const { lat, lng } = snap.data();
    const pos = new google.maps.LatLng(lat, lng);
    if (!liveUserMarker) {
      liveUserMarker = new google.maps.Marker({
        map,
        position: pos,
        title: "Tracking Child",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#d50000",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2
        }
      });
    } else {
      liveUserMarker.setPosition(pos);
    }
  });
}

// NEW: Modal for denied permission
function showLocationDeniedModal() {
  const modal = document.createElement("div");
  modal.innerHTML = `
    <div style="
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;
      z-index:9999;">
      <div style="background:#fff;padding:20px;border-radius:12px;max-width:400px;text-align:center;">
        <h3>Location Access Blocked</h3>
        <p>You have denied location access. Please enable it in your browser settings:</p>
        <ul style="text-align:left;">
          <li>Click the lock icon near the URL bar.</li>
          <li>Find "Location" and set it to "Allow".</li>
          <li>Reload this page and try again.</li>
        </ul>
        <button id="closeModal" style="margin-top:10px;padding:8px 16px;background:#ff6b00;color:#fff;border:none;border-radius:8px;cursor:pointer;">
          Close
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById("closeModal").addEventListener("click", () => modal.remove());
}


//last one Nilanthan said it not updating the live of the bus
// // js/track.js

// import { app, db, dbRT } from "./firebaseConfig.js";
// import {
//   doc, getDoc, setDoc, onSnapshot, serverTimestamp, updateDoc
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
// import {
//   ref as rtdbRef, query, limitToLast, onValue, off
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

// let map;
// let liveUserMarker = null;
// let busMarker = null;
// let busListener = null;
// let busRouteRenderer = null;
// let fromLoc, toLoc;
// let watchId = null;
// let isTrackingLive = false;

// function getClientId() {
//   let id = localStorage.getItem("clientId");
//   if (!id) {
//     id = crypto.randomUUID();
//     localStorage.setItem("clientId", id);
//   }
//   return id;
// }

// const clientId = getClientId();
// const urlParams = new URLSearchParams(window.location.search);
// const vcode = urlParams.get("vcode");

// window.onload = initMap;

// async function initMap() {
//   // Initialize the Google Map
//   map = new google.maps.Map(document.getElementById("map"), {
//     zoom: 12,
//     center: { lat: 7.8731, lng: 80.7718 },
//     fullscreenControl: false,
//     streetViewControl: false,
//   });

//   if (!vcode) {
//     alert("No V-Code provided.");
//     return;
//   }

//   // Fetch booking info from Firestore
//   const bookingRef = doc(db, "confirmedBookings", vcode);
//   const snap = await getDoc(bookingRef);
//   if (!snap.exists()) {
//     alert("Booking not found.");
//     return;
//   }

//   const { from, to, route, activeTracker } = snap.data();
//   document.getElementById("header-info").textContent =
//     `Bus #${route} • ${from} → ${to}`;

//   // Geocode pickup and drop locations
//   const geocoder = new google.maps.Geocoder();
//   [fromLoc, toLoc] = await Promise.all(
//     ["from", "to"].map(key => new Promise(res => {
//       geocoder.geocode({ address: snap.data()[key] }, (results, status) => {
//         res(status === "OK" ? results[0].geometry.location : null);
//       });
//     }))
//   );
//   if (!fromLoc || !toLoc) {
//     alert("Couldn’t geocode stops.");
//     return;
//   }

//   // Place pickup and drop markers
//   new google.maps.Marker({
//     map,
//     position: fromLoc,
//     icon: { url: "images/f.png", scaledSize: new google.maps.Size(32,32) },
//     title: "Pickup"
//   });
//   new google.maps.Marker({
//     map,
//     position: toLoc,
//     icon: { url: "images/t.png", scaledSize: new google.maps.Size(32,32) },
//     title: "Drop"
//   });

//   // Fit route bounds
//   const bounds = new google.maps.LatLngBounds();
//   bounds.extend(fromLoc);
//   bounds.extend(toLoc);
//   map.fitBounds(bounds, 100);
//   document.getElementById("info-bar").textContent = `${from} → ${to}`;

//   // Draw the route line
//   const directionsService = new google.maps.DirectionsService();
//   busRouteRenderer = new google.maps.DirectionsRenderer({
//     map,
//     suppressMarkers: true,
//     polylineOptions: { strokeColor: "#ff6b00", strokeWeight: 6 }
//   });
//   directionsService.route({
//     origin: fromLoc,
//     destination: toLoc,
//     travelMode: google.maps.TravelMode.DRIVING
//   }, (result, status) => {
//     if (status === "OK") {
//       busRouteRenderer.setDirections(result);
//     }
//   });

//   // Set up buttons
//   const startBtn = document.getElementById("btn-start-journey");
//   const liveBtn  = document.getElementById("btn-track-live");
//   const busBtn   = document.getElementById("btn-track-bus");

//   // Handle exclusive tracker assignment
//   if (!activeTracker) {
//     startBtn.style.display = "block";
//     liveBtn.style.display  = "none";
//     startBtn.addEventListener("click", async () => {
//       await setDoc(bookingRef, { activeTracker: clientId }, { merge: true });
//       startBtn.style.display = "none";
//       liveBtn.style.display  = "block";
//     });
//   } else if (activeTracker === clientId) {
//     startBtn.style.display = "none";
//     liveBtn.style.display  = "block";
//   } else {
//     startBtn.style.display = "none";
//     liveBtn.style.display  = "none";
//     subscribeToLive(activeTracker);
//   }

//   // Toggle publishing of user's live location
//   liveBtn.addEventListener("click", async () => {
//     if (!isTrackingLive) {
//       const allowed = await requestLocationPermission();
//       if (allowed) {
//         liveBtn.textContent = "Stop Live Tracking";
//       }
//     } else {
//       stopPublishing();
//       await updateDoc(bookingRef, { activeTracker: null });
//       liveBtn.textContent = "Track My Live Location";
//     }
//   });

//   // Bus tracking: show/hide live bus marker
//   busBtn.addEventListener("click", () => {
//     if (busListener) {
//       busListener();
//       busListener = null;
//       busMarker?.setMap(null);
//       busMarker = null;
//       busBtn.textContent = "Track Bus";
//     } else {
//       const historyRef = rtdbRef(dbRT, "/LocationHistory");
//       const historyQuery = query(historyRef, limitToLast(1));

//       busListener = onValue(historyQuery, snapshot => {
//         const obj = snapshot.val();
//           console.log("New bus location data:", obj);
//         if (!obj) return;
//         const key = Object.keys(obj)[0];
//         const { Latitude: lat, Longitude: lng } = obj[key];
//         if (lat == null || lng == null) return;

//         const pos = new google.maps.LatLng(lat, lng);
//         if (!busMarker) {
//           busMarker = new google.maps.Marker({
//             map,
//             position: pos,
//             icon: { url: "images/bus.png", scaledSize: new google.maps.Size(42,42) },
//             title: "Live Bus Location"
//           });
//           map.setZoom(15);
//         } else {
//           busMarker.setPosition(pos);
//         }
//         map.panTo(pos);
//       }, error => {
//         console.error("Realtime DB error:", error);
//       });

//       busBtn.textContent = "Stop Tracking Bus";
//     }
//   });
// }

// // NEW: Check location permission & show guide if denied
// async function requestLocationPermission() {
//   try {
//     const permission = await navigator.permissions.query({ name: "geolocation" });
//     if (permission.state === "granted") {
//       beginPublishing();
//       return true;
//     } else if (permission.state === "prompt") {
//       beginPublishing(); // Will show prompt
//       return true;
//     } else if (permission.state === "denied") {
//       showLocationDeniedModal();
//       return false;
//     }
//   } catch (err) {
//     console.error("Permission check error:", err);
//     beginPublishing();
//     return true;
//   }
// }

// // Start publishing user location
// function beginPublishing() {
//   isTrackingLive = true;
//   let firstUpdate = true;
//   watchId = navigator.geolocation.watchPosition(pos => {
//     const { latitude: lat, longitude: lng } = pos.coords;
//     const liveRef = doc(db, "confirmedBookings", vcode, "liveLocations", clientId);
//     setDoc(liveRef, { lat, lng, ts: serverTimestamp() });
//     const latlng = new google.maps.LatLng(lat, lng);
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map,
//         position: latlng,
//         icon: {
//           path: google.maps.SymbolPath.CIRCLE,
//           scale: 10,
//           fillColor: "#d50000",
//           fillOpacity: 1,
//           strokeColor: "#fff",
//           strokeWeight: 2
//         },
//         title: "My Live Location"
//       });
//     } else {
//       liveUserMarker.setPosition(latlng);
//     }
//     if (firstUpdate) {
//       map.panTo(latlng);
//       firstUpdate = false;
//     }
//   }, err => console.warn(err), { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 });
// }

// function stopPublishing() {
//   if (watchId !== null) {
//     navigator.geolocation.clearWatch(watchId);
//     watchId = null;
//   }
//   liveUserMarker?.setMap(null);
//   liveUserMarker = null;
//   isTrackingLive = false;
// }

// function subscribeToLive(trackerId) {
//   const liveRef = doc(db, "confirmedBookings", vcode, "liveLocations", trackerId);
//   onSnapshot(liveRef, snap => {
//     if (!snap.exists()) return;
//     const { lat, lng } = snap.data();
//     const pos = new google.maps.LatLng(lat, lng);
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map,
//         position: pos,
//         title: "Tracking Child",
//         icon: {
//           path: google.maps.SymbolPath.CIRCLE,
//           scale: 10,
//           fillColor: "#d50000",
//           fillOpacity: 1,
//           strokeColor: "#fff",
//           strokeWeight: 2
//         }
//       });
//     } else {
//       liveUserMarker.setPosition(pos);
//     }
//   });
// }

// // NEW: Modal for denied permission
// function showLocationDeniedModal() {
//   const modal = document.createElement("div");
//   modal.innerHTML = `
//     <div style="
//       position:fixed;top:0;left:0;width:100%;height:100%;
//       background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;
//       z-index:9999;">
//       <div style="background:#fff;padding:20px;border-radius:12px;max-width:400px;text-align:center;">
//         <h3>Location Access Blocked</h3>
//         <p>You have denied location access. Please enable it in your browser settings:</p>
//         <ul style="text-align:left;">
//           <li>Click the lock icon near the URL bar.</li>
//           <li>Find "Location" and set it to "Allow".</li>
//           <li>Reload this page and try again.</li>
//         </ul>
//         <button id="closeModal" style="margin-top:10px;padding:8px 16px;background:#ff6b00;color:#fff;border:none;border-radius:8px;cursor:pointer;">
//           Close
//         </button>
//       </div>
//     </div>`;
//   document.body.appendChild(modal);
//   document.getElementById("closeModal").addEventListener("click", () => modal.remove());
// }


// // js/track.js

// import { app, db, dbRT } from "./firebaseConfig.js";
// import {
//   doc, getDoc, setDoc, onSnapshot, serverTimestamp, updateDoc
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
// import {
//   ref as rtdbRef, query, limitToLast, onValue, off
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

// let map;
// let liveUserMarker = null;
// let busMarker = null;
// let busListener = null;
// let busRouteRenderer = null;
// let fromLoc, toLoc;
// let watchId = null;
// let isTrackingLive = false;

// function getClientId() {
//   let id = localStorage.getItem("clientId");
//   if (!id) {
//     id = crypto.randomUUID();
//     localStorage.setItem("clientId", id);
//   }
//   return id;
// }

// const clientId = getClientId();
// const urlParams = new URLSearchParams(window.location.search);
// const vcode = urlParams.get("vcode");

// window.onload = initMap;

// async function initMap() {
//   // Initialize the Google Map
//   map = new google.maps.Map(document.getElementById("map"), {
//     zoom: 12,
//     center: { lat: 7.8731, lng: 80.7718 },
//     fullscreenControl: false,
//     streetViewControl: false,
//   });

//   if (!vcode) {
//     alert("No V-Code provided.");
//     return;
//   }

//   // Fetch booking info from Firestore
//   const bookingRef = doc(db, "confirmedBookings", vcode);
//   const snap = await getDoc(bookingRef);
//   if (!snap.exists()) {
//     alert("Booking not found.");
//     return;
//   }

//   const { from, to, route, activeTracker } = snap.data();
//   document.getElementById("header-info").textContent =
//     `Bus #${route} • ${from} → ${to}`;

//   // Geocode pickup and drop locations
//   const geocoder = new google.maps.Geocoder();
//   [fromLoc, toLoc] = await Promise.all(
//     ["from", "to"].map(key => new Promise(res => {
//       geocoder.geocode({ address: snap.data()[key] }, (results, status) => {
//         res(status === "OK" ? results[0].geometry.location : null);
//       });
//     }))
//   );
//   if (!fromLoc || !toLoc) {
//     alert("Couldn’t geocode stops.");
//     return;
//   }

//   // Place pickup and drop markers
//   new google.maps.Marker({
//     map,
//     position: fromLoc,
//     icon: { url: "images/f.png", scaledSize: new google.maps.Size(32,32) },
//     title: "Pickup"
//   });
//   new google.maps.Marker({
//     map,
//     position: toLoc,
//     icon: { url: "images/t.png", scaledSize: new google.maps.Size(32,32) },
//     title: "Drop"
//   });

//   // Fit route bounds
//   const bounds = new google.maps.LatLngBounds();
//   bounds.extend(fromLoc);
//   bounds.extend(toLoc);
//   map.fitBounds(bounds, 100);
//   document.getElementById("info-bar").textContent = `${from} → ${to}`;

//   // Draw the route line
//   const directionsService = new google.maps.DirectionsService();
//   busRouteRenderer = new google.maps.DirectionsRenderer({
//     map,
//     suppressMarkers: true,
//     polylineOptions: { strokeColor: "#ff6b00", strokeWeight: 6 }
//   });
//   directionsService.route({
//     origin: fromLoc,
//     destination: toLoc,
//     travelMode: google.maps.TravelMode.DRIVING
//   }, (result, status) => {
//     if (status === "OK") {
//       busRouteRenderer.setDirections(result);
//     }
//   });

//   // Set up buttons
//   const startBtn = document.getElementById("btn-start-journey");
//   const liveBtn  = document.getElementById("btn-track-live");
//   const busBtn   = document.getElementById("btn-track-bus");

//   // Handle exclusive tracker assignment
//   if (!activeTracker) {
//     startBtn.style.display = "block";
//     liveBtn.style.display  = "none";
//     startBtn.addEventListener("click", async () => {
//       await setDoc(bookingRef, { activeTracker: clientId }, { merge: true });
//       startBtn.style.display = "none";
//       liveBtn.style.display  = "block";
//     });
//   } else if (activeTracker === clientId) {
//     startBtn.style.display = "none";
//     liveBtn.style.display  = "block";
//   } else {
//     startBtn.style.display = "none";
//     liveBtn.style.display  = "none";
//     subscribeToLive(activeTracker);
//   }

//   // Toggle publishing of user's live location
//   liveBtn.addEventListener("click", async () => {
//     if (!isTrackingLive) {
//       beginPublishing();
//       liveBtn.textContent = "Stop Live Tracking";
//     } else {
//       stopPublishing();
//       await updateDoc(bookingRef, { activeTracker: null });
//       liveBtn.textContent = "Track My Live Location";
//     }
//   });

//   // Bus tracking: show/hide live bus marker
//   busBtn.addEventListener("click", () => {
//     if (busListener) {
//       // Stop tracking the bus
//       busListener();
//       busListener = null;
//       busMarker?.setMap(null);
//       busMarker = null;
//       busBtn.textContent = "Track Bus";
//     } else {
//       // Start tracking: always fetch & listen to the last GPS entry
//       const historyRef = rtdbRef(dbRT, "/LocationHistory");
//       const historyQuery = query(historyRef, limitToLast(1));

//       busListener = onValue(historyQuery, snapshot => {
//         const obj = snapshot.val();
//         if (!obj) return;
//         const key = Object.keys(obj)[0];
//         const { Latitude: lat, Longitude: lng } = obj[key];
//         if (lat == null || lng == null) return;

//         const pos = new google.maps.LatLng(lat, lng);
//         if (!busMarker) {
//           busMarker = new google.maps.Marker({
//             map,
//             position: pos,
//             icon: { url: "images/bus.png", scaledSize: new google.maps.Size(42,42) },
//             title: "Live Bus Location"
//           });
//           map.setZoom(15);
//         } else {
//           busMarker.setPosition(pos);
//         }
//         map.panTo(pos);
//       }, error => {
//         console.error("Realtime DB error:", error);
//       });

//       busBtn.textContent = "Stop Tracking Bus";
//     }
//   });
// }

// function beginPublishing() {
//   isTrackingLive = true;
//   let firstUpdate = true;
//   watchId = navigator.geolocation.watchPosition(pos => {
//     const { latitude: lat, longitude: lng } = pos.coords;
//     const liveRef = doc(db, "confirmedBookings", vcode, "liveLocations", clientId);
//     setDoc(liveRef, { lat, lng, ts: serverTimestamp() });
//     const latlng = new google.maps.LatLng(lat, lng);
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map,
//         position: latlng,
//         icon: {
//           path: google.maps.SymbolPath.CIRCLE,
//           scale: 10,
//           fillColor: "#d50000",
//           fillOpacity: 1,
//           strokeColor: "#fff",
//           strokeWeight: 2
//         },
//         title: "My Live Location"
//       });
//     } else {
//       liveUserMarker.setPosition(latlng);
//     }
//     if (firstUpdate) {
//       map.panTo(latlng);
//       firstUpdate = false;
//     }
//   }, err => console.warn(err), { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 });
// }

// function stopPublishing() {
//   if (watchId !== null) {
//     navigator.geolocation.clearWatch(watchId);
//     watchId = null;
//   }
//   liveUserMarker?.setMap(null);
//   liveUserMarker = null;
//   isTrackingLive = false;
// }

// function subscribeToLive(trackerId) {
//   const liveRef = doc(db, "confirmedBookings", vcode, "liveLocations", trackerId);
//   onSnapshot(liveRef, snap => {
//     if (!snap.exists()) return;
//     const { lat, lng } = snap.data();
//     const pos = new google.maps.LatLng(lat, lng);
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map,
//         position: pos,
//         title: "Tracking Child",
//         icon: {
//           path: google.maps.SymbolPath.CIRCLE,
//           scale: 10,
//           fillColor: "#d50000",
//           fillOpacity: 1,
//           strokeColor: "#fff",
//           strokeWeight: 2
//         }
//       });
//     } else {
//       liveUserMarker.setPosition(pos);
//     }
//   });
// }




// // js/track.js
// import { db } from './firebaseConfig.js';
// import { 
//   doc, getDoc, setDoc, onSnapshot, serverTimestamp, updateDoc 
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// let map, userMarker, liveUserMarker, busMarker, busAnimInterval;
// let busRouteRenderer, userToPickupLine;
// let fromLoc, toLoc;
// let watchId = null; // for stopping geolocation watch
// let isTrackingLive = false;

// function getClientId() {
//   let id = localStorage.getItem('clientId');
//   if (!id) {
//     id = crypto.randomUUID();
//     localStorage.setItem('clientId', id);
//   }
//   return id;
// }
// const clientId = getClientId();

// const urlParams = new URLSearchParams(window.location.search);
// const vcode = urlParams.get('vcode');

// async function initMap() {
//   map = new google.maps.Map(document.getElementById('map'), {
//     zoom: 12,
//     center: { lat: 7.8731, lng: 80.7718 },
//     fullscreenControl: false,
//     streetViewControl: false
//   });

//   if (!vcode) return alert("No V‑Code provided.");
//   const bookingRef = doc(db, 'confirmedBookings', vcode);
//   const snap = await getDoc(bookingRef);
//   if (!snap.exists()) return alert("Booking not found.");

//   const { from, to, route } = snap.data();
//   document.getElementById('header-info').textContent = `Bus #${route} • ${from} → ${to}`;

//   const geocoder = new google.maps.Geocoder();
//   [fromLoc, toLoc] = await Promise.all(['from','to'].map(key =>
//     new Promise(res => geocoder.geocode({ address: snap.data()[key] }, (r,s) =>
//       res(s==='OK' ? r[0].geometry.location : null)
//     ))
//   ));
//   if (!fromLoc || !toLoc) return alert("Couldn’t geocode stops.");

//   const iconOpts = size => ({
//     url: size === 'from' ? 'images/f.png' : 'images/t.png',
//     scaledSize: new google.maps.Size(32, 32)
//   });
//   new google.maps.Marker({ map, position: fromLoc, icon: iconOpts('from'), title: 'Pickup' });
//   new google.maps.Marker({ map, position: toLoc,   icon: iconOpts('to'),   title: 'Drop' });

//   const bounds = new google.maps.LatLngBounds();
//   [fromLoc, toLoc].forEach(p => bounds.extend(p));
//   map.fitBounds(bounds, 100);
//   document.getElementById('info-bar').textContent = `${from} → ${to}`;

//   const directionsService = new google.maps.DirectionsService();
//   busRouteRenderer = new google.maps.DirectionsRenderer({
//     map,
//     suppressMarkers: true,
//     polylineOptions: { strokeColor: '#ff6b00', strokeWeight: 6 }
//   });
//   directionsService.route({
//     origin: fromLoc,
//     destination: toLoc,
//     travelMode: google.maps.TravelMode.DRIVING
//   }, (res, status) => {
//     if (status === 'OK') busRouteRenderer.setDirections(res);
//   });

//   // --- Exclusive tracking role ---
//   const data = snap.data() || {};
//   const activeTracker = data.activeTracker;
//   const startBtn = document.getElementById('btn-start-journey');
//   const liveBtn  = document.getElementById('btn-track-live');

//   if (!activeTracker) {
//     startBtn.style.display = 'block';
//     liveBtn.style.display  = 'none';
//     startBtn.addEventListener('click', async () => {
//       await setDoc(bookingRef, { activeTracker: clientId }, { merge: true });
//       startBtn.style.display = 'none';
//       liveBtn.style.display  = 'block';
//     });

//   } else if (activeTracker === clientId) {
//     startBtn.style.display = 'none';
//     liveBtn.style.display  = 'block';
//   } else {
//     startBtn.style.display = 'none';
//     liveBtn.style.display  = 'none';
//     subscribeToLive(activeTracker);
//   }

//   // --- Live location toggle ---
//   liveBtn.addEventListener('click', async () => {
//     if (!isTrackingLive) {
//       beginPublishing();
//       liveBtn.textContent = 'Stop Live Tracking';
//     } else {
//       stopPublishing();
//       await updateDoc(bookingRef, { activeTracker: null });
//       liveBtn.textContent = 'Track My Live Location';
//     }
//   });

//   // --- Bus Tracking Button ---
//   const busBtn = document.getElementById('btn-track-bus');
//   busBtn.addEventListener('click', () => {
//     if (busMarker) {
//       // stop tracking
//       clearInterval(busAnimInterval);
//       busMarker.setMap(null);
//       busMarker = null;
//       busBtn.textContent = 'Track Bus';
//     } else {
//       // start tracking
//       const startLat = fromLoc.lat() + 0.005;
//       const startLng = fromLoc.lng() + 0.005;
//       busMarker = new google.maps.Marker({
//         map,
//         position: { lat: startLat, lng: startLng },
//         icon: {
//           url: 'images/bus.png',
//           scaledSize: new google.maps.Size(42, 42)
//         },
//         title: 'Bus'
//       });
//       busBtn.textContent = 'Stop Tracking Bus';
//       const steps = 100;
//       let step = 10;
//       const deltaLat = (fromLoc.lat() - startLat) / steps;
//       const deltaLng = (fromLoc.lng() - startLng) / steps;
//       busAnimInterval = setInterval(() => {
//         if (step >= steps) {
//           clearInterval(busAnimInterval);
//           return;
//         }
//         const pos = busMarker.getPosition();
//         busMarker.setPosition({
//           lat: pos.lat() + deltaLat,
//           lng: pos.lng() + deltaLng
//         });
//         step++;
//       }, 100);
//     }
//   });

//   document.getElementById('back-btn').addEventListener('click', () => {
//     window.location.href = 'journey.html';
//   });
// }

// function beginPublishing() {
//   isTrackingLive = true;
//   let firstUpdate = true;
//   watchId = navigator.geolocation.watchPosition(pos => {
//     const { latitude: lat, longitude: lng } = pos.coords;
//     const liveRef = doc(db, 'confirmedBookings', vcode, 'liveLocations', clientId);
//     setDoc(liveRef, { lat, lng, ts: serverTimestamp() });
//     const posLatLng = new google.maps.LatLng(lat, lng);
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map,
//         position: posLatLng,
//         icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#d50000', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
//         title: "My Live Location"
//       });
//     } else {
//       liveUserMarker.setPosition(posLatLng);
//     }
//     if (firstUpdate) {
//       map.panTo(posLatLng); // center only first time
//       firstUpdate = false;
//     }
//   }, err => console.warn(err), { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 });
// }

// function stopPublishing() {
//   if (watchId !== null) {
//     navigator.geolocation.clearWatch(watchId);
//     watchId = null;
//   }
//   if (liveUserMarker) {
//     liveUserMarker.setMap(null);
//     liveUserMarker = null;
//   }
//   isTrackingLive = false;
// }

// function subscribeToLive(trackerId) {
//   const liveRef = doc(db, 'confirmedBookings', vcode, 'liveLocations', trackerId);
//   onSnapshot(liveRef, snap => {
//     if (!snap.exists()) return;
//     const { lat, lng } = snap.data();
//     const pos = new google.maps.LatLng(lat, lng);
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map,
//         position: pos,
//         title: 'Tracking Child',
//         icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillOpacity: 1, fillColor: '#d50000', strokeWeight: 2 }
//       });
//     } else {
//       liveUserMarker.setPosition(pos);
//     }
//   });
// }

// window.onload = initMap;



//last corrected one but map automatically snap back to the live location
// // js/track.js
// import { db } from './firebaseConfig.js';
// import { 
//   doc, getDoc, setDoc, onSnapshot, serverTimestamp 
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// let map, userMarker, liveUserMarker, busMarker, busAnimInterval;
// let busRouteRenderer, userToPickupLine;
// let fromLoc, toLoc;

// function getClientId() {
//   let id = localStorage.getItem('clientId');
//   if (!id) {
//     id = crypto.randomUUID();
//     localStorage.setItem('clientId', id);
//   }
//   return id;
// }
// const clientId = getClientId();

// const urlParams = new URLSearchParams(window.location.search);
// const vcode = urlParams.get('vcode');

// async function initMap() {
//   map = new google.maps.Map(document.getElementById('map'), {
//     zoom: 12,
//     center: { lat: 7.8731, lng: 80.7718 },
//     fullscreenControl: false,
//     streetViewControl: false
//   });

//   if (!vcode) return alert("No V‑Code provided.");
//   const bookingRef = doc(db, 'confirmedBookings', vcode);
//   const snap = await getDoc(bookingRef);
//   if (!snap.exists()) return alert("Booking not found.");

//   const { from, to, route } = snap.data();
//   document.getElementById('header-info').textContent = `Bus #${route} • ${from} → ${to}`;

//   const geocoder = new google.maps.Geocoder();
//   [fromLoc, toLoc] = await Promise.all(['from','to'].map(key =>
//     new Promise(res => geocoder.geocode({ address: snap.data()[key] }, (r,s) =>
//       res(s==='OK' ? r[0].geometry.location : null)
//     ))
//   ));
//   if (!fromLoc || !toLoc) return alert("Couldn’t geocode stops.");

//   const iconOpts = size => ({
//     url: size === 'from' ? 'images/f.png' : 'images/t.png',
//     scaledSize: new google.maps.Size(32, 32)
//   });
//   new google.maps.Marker({ map, position: fromLoc, icon: iconOpts('from'), title: 'Pickup' });
//   new google.maps.Marker({ map, position: toLoc,   icon: iconOpts('to'),   title: 'Drop' });

//   const bounds = new google.maps.LatLngBounds();
//   [fromLoc, toLoc].forEach(p => bounds.extend(p));
//   map.fitBounds(bounds, 100);
//   document.getElementById('info-bar').textContent = `${from} → ${to}`;

//   const directionsService = new google.maps.DirectionsService();
//   busRouteRenderer = new google.maps.DirectionsRenderer({
//     map,
//     suppressMarkers: true,
//     polylineOptions: { strokeColor: '#ff6b00', strokeWeight: 6 }
//   });
//   directionsService.route({
//     origin: fromLoc,
//     destination: toLoc,
//     travelMode: google.maps.TravelMode.DRIVING
//   }, (res, status) => {
//     if (status === 'OK') busRouteRenderer.setDirections(res);
//   });

//   // --- Exclusive tracking role ---
//   const data = snap.data() || {};
//   const activeTracker = data.activeTracker;
//   const startBtn = document.getElementById('btn-start-journey');
//   const liveBtn  = document.getElementById('btn-track-live');

//   if (!activeTracker) {
//     startBtn.style.display = 'block';
//     liveBtn.style.display  = 'none';
//     startBtn.addEventListener('click', async () => {
//       await setDoc(bookingRef, { activeTracker: clientId }, { merge: true });
//       startBtn.style.display = 'none';
//       liveBtn.style.display  = 'block';
//       beginPublishing(); 
//     });

//   } else if (activeTracker === clientId) {
//     startBtn.style.display = 'none';
//     liveBtn.style.display  = 'block';
//     beginPublishing();

//   } else {
//     startBtn.style.display = 'none';
//     liveBtn.style.display  = 'none';
//     subscribeToLive(activeTracker);
//   }

//   // --- New: Bus Tracking Button ---
//   const busBtn = document.getElementById('btn-track-bus');
//   busBtn.addEventListener('click', () => {
//     if (busMarker) {
//       // stop tracking
//       clearInterval(busAnimInterval);
//       busMarker.setMap(null);
//       busMarker = null;
//       busBtn.textContent = 'Track Bus';
//     } else {
//       // start tracking
//       const startLat = fromLoc.lat() + 0.005;
//       const startLng = fromLoc.lng() + 0.005;
//       busMarker = new google.maps.Marker({
//         map,
//         position: { lat: startLat, lng: startLng },
//         icon: {
//           url: 'images/bus.png',
//           scaledSize: new google.maps.Size(42, 42)
//         },
//         title: 'Bus'
//       });
//       busBtn.textContent = 'Stop Tracking Bus';
//       // animate toward fromLoc
//       const steps = 100;
//       let step = 10;
//       const deltaLat = (fromLoc.lat() - startLat) / steps;
//       const deltaLng = (fromLoc.lng() - startLng) / steps;
//       busAnimInterval = setInterval(() => {
//         if (step >= steps) {
//           clearInterval(busAnimInterval);
//           return;
//         }
//         const pos = busMarker.getPosition();
//         busMarker.setPosition({
//           lat: pos.lat() + deltaLat,
//           lng: pos.lng() + deltaLng
//         });
//         step++;
//       }, 100);
//     }
//   });

//   document.getElementById('back-btn').addEventListener('click', () => {
//     window.location.href = 'journey.html';
//   });
// }

// function beginPublishing() {
//   navigator.geolocation.watchPosition(pos => {
//     const { latitude: lat, longitude: lng } = pos.coords;
//     const liveRef = doc(db, 'confirmedBookings', vcode, 'liveLocations', clientId);
//     setDoc(liveRef, { lat, lng, ts: serverTimestamp() });
//     const posLatLng = new google.maps.LatLng(lat, lng);
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map,
//         position: posLatLng,
//         icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#d50000', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
//         title: "My Live Location"
//       });
//     } else {
//       liveUserMarker.setPosition(posLatLng);
//     }
//     map.panTo(posLatLng);
//   }, err => console.warn(err), { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 });
// }

// function subscribeToLive(trackerId) {
//   const liveRef = doc(db, 'confirmedBookings', vcode, 'liveLocations', trackerId);
//   onSnapshot(liveRef, snap => {
//     if (!snap.exists()) return;
//     const { lat, lng } = snap.data();
//     const pos = new google.maps.LatLng(lat, lng);
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map,
//         position: pos,
//         title: 'Tracking Child',
//         icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillOpacity: 1, fillColor: '#d50000', strokeWeight: 2 }
//       });
//     } else {
//       liveUserMarker.setPosition(pos);
//     }
//     map.panTo(pos);
//   });
// }

// window.onload = initMap;
















// old code without location tracking and bus tracking
// //track.js
// import { db } from './firebaseConfig.js';
// import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";


// let map, userMarker, liveUserMarker;
// let busRouteRenderer, userToPickupLine, liveLineToDrop;
// let fromLoc, toLoc;

// // at top of track.js
// import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// function getClientId() {
//   let id = localStorage.getItem('clientId');
//   if (!id) {
//     id = crypto.randomUUID();
//     localStorage.setItem('clientId', id);
//   }
//   return id;
// }
// const clientId = getClientId();


// const urlParams = new URLSearchParams(window.location.search);
// const vcode = urlParams.get('vcode');

// async function initMap() {
//   map = new google.maps.Map(document.getElementById('map'), {
//     zoom: 12,
//     center: { lat: 7.8731, lng: 80.7718 },
//     fullscreenControl: false,
//     streetViewControl: false
//   });

//   if (!vcode) return alert("No V‑Code provided.");
//   const snap = await getDoc(doc(db, 'confirmedBookings', vcode));
//   if (!snap.exists()) return alert("Booking not found.");

//   const { from, to, route } = snap.data();
//   document.getElementById('header-info').textContent = `Bus #${route} • ${from} → ${to}`;

//   const geocoder = new google.maps.Geocoder();
//   [fromLoc, toLoc] = await Promise.all(['from','to'].map(key =>
//     new Promise(res => geocoder.geocode({ address: snap.data()[key] }, (r,s) =>
//       res(s==='OK' ? r[0].geometry.location : null)
//     ))
//   ));
//   if (!fromLoc || !toLoc) return alert("Couldn’t geocode stops.");

//   const iconOpts = size => ({
//     url: size === 'from' ? 'images/f.png' : 'images/t.png',
//     scaledSize: new google.maps.Size(32, 32)
//   });
//   new google.maps.Marker({ map, position: fromLoc, icon: iconOpts('from'), title: 'Pickup' });
//   new google.maps.Marker({ map, position: toLoc,   icon: iconOpts('to'),   title: 'Drop' });

//   const bounds = new google.maps.LatLngBounds();
//   [fromLoc, toLoc].forEach(p => bounds.extend(p));
//   map.fitBounds(bounds, 100);
//   document.getElementById('info-bar').textContent = `${from} → ${to}`;

//   const directionsService = new google.maps.DirectionsService();
//   busRouteRenderer = new google.maps.DirectionsRenderer({
//     map,
//     suppressMarkers: true,
//     polylineOptions: { strokeColor: '#ff6b00', strokeWeight: 6 }
//   });
//   directionsService.route({
//     origin: fromLoc,
//     destination: toLoc,
//     travelMode: google.maps.TravelMode.DRIVING
//   }, (res, status) => {
//     if (status === 'OK') busRouteRenderer.setDirections(res);
//   });

//   userToPickupLine = new google.maps.Polyline({
//     map,
//     strokeColor: '#ff6b00',
//     strokeOpacity: 0.8,
//     strokeWeight: 4,
//     path: []
//   });

//   if (navigator.geolocation) {
//     navigator.geolocation.watchPosition(pos => {
//       const latlng = {
//         lat: pos.coords.latitude,
//         lng: pos.coords.longitude
//       };
//       if (!userMarker) {
//         userMarker = new google.maps.Marker({
//           position: latlng,
//           map,
//           title: "You are here",
//           icon: {
//             path: google.maps.SymbolPath.CIRCLE,
//             scale: 8,
//             fillColor: '#ff6b00',
//             fillOpacity: 0.9,
//             strokeColor: '#fff',
//             strokeWeight: 2
//           }
//         });
//       } else {
//         userMarker.setPosition(latlng);
//       }
//       userToPickupLine.setPath([latlng, fromLoc]);
//     }, err => console.warn(err), {
//       enableHighAccuracy: true,
//       maximumAge: 0,
//       timeout: 5000
//     });
//   }

//   document.getElementById('btn-center')?.addEventListener('click', () => {
//     if (userMarker) map.panTo(userMarker.getPosition());
//   });

//   // LIVE TRACK BUTTON
//   document.getElementById('btn-track-live').addEventListener('click', () => {
//     if (navigator.geolocation) {
//       navigator.geolocation.getCurrentPosition(pos => {
//         const userPos = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);

//         if (!liveUserMarker) {
//           liveUserMarker = new google.maps.Marker({
//             map,
//             position: userPos,
//             icon: {
//               path: google.maps.SymbolPath.CIRCLE,
//               scale: 10,
//               fillColor: '#d50000',
//               fillOpacity: 1,
//               strokeColor: '#fff',
//               strokeWeight: 2
//             },
//             title: "Live You"
//           });
//         } else {
//           liveUserMarker.setPosition(userPos);
//         }

//         // Red line from user → drop
//         if (!liveLineToDrop) {
//           liveLineToDrop = new google.maps.Polyline({
//             map,
//             strokeColor: '#d50000',
//             strokeOpacity: 0.8,
//             strokeWeight: 4,
//             path: [userPos, toLoc]
//           });
//         } else {
//           liveLineToDrop.setPath([userPos, toLoc]);
//         }

//         // Show distance
//         const distKm = google.maps.geometry.spherical.computeDistanceBetween(userPos, toLoc) / 1000;
//         alert(`Distance to drop: ${distKm.toFixed(2)} km`);

//         map.panTo(userPos);
//       }, err => {
//         alert("Unable to get live location");
//         console.warn(err);
//       }, {
//         enableHighAccuracy: true,
//         timeout: 7000
//       });
//     }
//   });
// }

// async function initMap() {
//   // … all your existing initMap() code up to route drawing …
  
//   const bookingRef = doc(db, 'confirmedBookings', vcode);
//   const bookingSnap = await getDoc(bookingRef);
//   const data = bookingSnap.data() || {};
//   const activeTracker = data.activeTracker; // may be undefined

//   const startBtn = document.getElementById('btn-start-journey');
//   const liveBtn  = document.getElementById('btn-track-live');

//   if (!activeTracker) {
//     // Nobody’s live yet → this client *can* become the tracker
//     startBtn.style.display = 'block';
//     liveBtn.style.display  = 'none';
//     startBtn.addEventListener('click', async () => {
//       // claim it
//       await setDoc(bookingRef, { activeTracker: clientId }, { merge: true });
//       startBtn.style.display = 'none';
//       liveBtn.style.display  = 'block';
//       beginPublishing();        // start your own GPS → Firestore
//     });

//   } else if (activeTracker === clientId) {
//     // You’re *already* the tracker
//     startBtn.style.display = 'none';
//     liveBtn.style.display  = 'block';
//     beginPublishing();

//   } else {
//     // Someone else beat you to it → you only *subscribe*
//     startBtn.style.display = 'none';
//     liveBtn.style.display  = 'none';
//     subscribeToLive(activeTracker);
//   }

//   // … remove your old live‑track click handler …
// }

// function beginPublishing() {
//   navigator.geolocation.watchPosition(pos => {
//     const { latitude: lat, longitude: lng } = pos.coords;
//     // write to a sub‑doc under this booking
//     const liveRef = doc(db, 'confirmedBookings', vcode, 'liveLocations', clientId);
//     setDoc(liveRef, { lat, lng, ts: serverTimestamp() });
//     // (Optionally, update your own marker on the map right here)
//   }, err => console.warn(err), {
//     enableHighAccuracy: true, maximumAge: 0, timeout: 7000
//   });
// }

// function subscribeToLive(trackerId) {
//   const liveRef = doc(db, 'confirmedBookings', vcode, 'liveLocations', trackerId);
//   onSnapshot(liveRef, snap => {
//     if (!snap.exists()) return;
//     const { lat, lng } = snap.data();
//     const pos = new google.maps.LatLng(lat, lng);
//     // if you want to show a marker for the child:
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map, position: pos, title: 'Tracking child', icon: {
//           path: google.maps.SymbolPath.CIRCLE,
//           scale: 10, fillOpacity: 1, strokeWeight: 2
//         }
//       });
//     } else {
//       liveUserMarker.setPosition(pos);
//     }
//     map.panTo(pos);
//   });
// }



// old code without bus tracking 
// import { db } from './firebaseConfig.js';
// import { 
//   doc, getDoc, setDoc, onSnapshot, serverTimestamp 
// } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// let map, userMarker, liveUserMarker;
// let busRouteRenderer, userToPickupLine;
// let fromLoc, toLoc;

// function getClientId() {
//   let id = localStorage.getItem('clientId');
//   if (!id) {
//     id = crypto.randomUUID();
//     localStorage.setItem('clientId', id);
//   }
//   return id;
// }
// const clientId = getClientId();

// const urlParams = new URLSearchParams(window.location.search);
// const vcode = urlParams.get('vcode');

// async function initMap() {
//   map = new google.maps.Map(document.getElementById('map'), {
//     zoom: 12,
//     center: { lat: 7.8731, lng: 80.7718 },
//     fullscreenControl: false,
//     streetViewControl: false
//   });

//   if (!vcode) return alert("No V‑Code provided.");
//   const bookingRef = doc(db, 'confirmedBookings', vcode);
//   const snap = await getDoc(bookingRef);
//   if (!snap.exists()) return alert("Booking not found.");

//   const { from, to, route } = snap.data();
//   document.getElementById('header-info').textContent = `Bus #${route} • ${from} → ${to}`;

//   const geocoder = new google.maps.Geocoder();
//   [fromLoc, toLoc] = await Promise.all(['from','to'].map(key =>
//     new Promise(res => geocoder.geocode({ address: snap.data()[key] }, (r,s) =>
//       res(s==='OK' ? r[0].geometry.location : null)
//     ))
//   ));
//   if (!fromLoc || !toLoc) return alert("Couldn’t geocode stops.");

//   const iconOpts = size => ({
//     url: size === 'from' ? 'images/f.png' : 'images/t.png',
//     scaledSize: new google.maps.Size(32, 32)
//   });
//   new google.maps.Marker({ map, position: fromLoc, icon: iconOpts('from'), title: 'Pickup' });
//   new google.maps.Marker({ map, position: toLoc,   icon: iconOpts('to'),   title: 'Drop' });

//   const bounds = new google.maps.LatLngBounds();
//   [fromLoc, toLoc].forEach(p => bounds.extend(p));
//   map.fitBounds(bounds, 100);
//   document.getElementById('info-bar').textContent = `${from} → ${to}`;

//   const directionsService = new google.maps.DirectionsService();
//   busRouteRenderer = new google.maps.DirectionsRenderer({
//     map,
//     suppressMarkers: true,
//     polylineOptions: { strokeColor: '#ff6b00', strokeWeight: 6 }
//   });
//   directionsService.route({
//     origin: fromLoc,
//     destination: toLoc,
//     travelMode: google.maps.TravelMode.DRIVING
//   }, (res, status) => {
//     if (status === 'OK') busRouteRenderer.setDirections(res);
//   });

//   // --- Exclusive tracking role ---
//   const data = snap.data() || {};
//   const activeTracker = data.activeTracker;
//   const startBtn = document.getElementById('btn-start-journey');
//   const liveBtn  = document.getElementById('btn-track-live');

//   if (!activeTracker) {
//     // Nobody live → allow this device to start
//     startBtn.style.display = 'block';
//     liveBtn.style.display  = 'none';
//     startBtn.addEventListener('click', async () => {
//       await setDoc(bookingRef, { activeTracker: clientId }, { merge: true });
//       startBtn.style.display = 'none';
//       liveBtn.style.display  = 'block';
//       beginPublishing(); 
//     });

//   } else if (activeTracker === clientId) {
//     // This device is the tracker
//     startBtn.style.display = 'none';
//     liveBtn.style.display  = 'block';
//     beginPublishing();

//   } else {
//     // Another device is tracking → just subscribe
//     startBtn.style.display = 'none';
//     liveBtn.style.display  = 'none';
//     subscribeToLive(activeTracker);
//   }

//   document.getElementById('back-btn').addEventListener('click', () => {
//     window.location.href = 'journey.html';
//   });
// }

// function beginPublishing() {
//   navigator.geolocation.watchPosition(pos => {
//     const { latitude: lat, longitude: lng } = pos.coords;
//     const liveRef = doc(db, 'confirmedBookings', vcode, 'liveLocations', clientId);
//     setDoc(liveRef, { lat, lng, ts: serverTimestamp() });
//     // Update marker on map
//     const posLatLng = new google.maps.LatLng(lat, lng);
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map,
//         position: posLatLng,
//         icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#d50000', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
//         title: "My Live Location"
//       });
//     } else {
//       liveUserMarker.setPosition(posLatLng);
//     }
//     map.panTo(posLatLng);
//   }, err => console.warn(err), { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 });
// }

// function subscribeToLive(trackerId) {
//   const liveRef = doc(db, 'confirmedBookings', vcode, 'liveLocations', trackerId);
//   onSnapshot(liveRef, snap => {
//     if (!snap.exists()) return;
//     const { lat, lng } = snap.data();
//     const pos = new google.maps.LatLng(lat, lng);
//     if (!liveUserMarker) {
//       liveUserMarker = new google.maps.Marker({
//         map,
//         position: pos,
//         title: 'Tracking Child',
//         icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillOpacity: 1, fillColor: '#d50000', strokeWeight: 2 }
//       });
//     } else {
//       liveUserMarker.setPosition(pos);
//     }
//     map.panTo(pos);
//   });
// }

// window.onload = initMap;


