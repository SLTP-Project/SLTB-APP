// js/track.js
import { db } from './firebaseConfig.js';
import { 
  doc, getDoc, setDoc, onSnapshot, serverTimestamp, updateDoc 
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let map, userMarker, liveUserMarker, busMarker, busAnimInterval;
let busRouteRenderer, userToPickupLine;
let fromLoc, toLoc;
let watchId = null; // for stopping geolocation watch
let isTrackingLive = false;

function getClientId() {
  let id = localStorage.getItem('clientId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('clientId', id);
  }
  return id;
}
const clientId = getClientId();

const urlParams = new URLSearchParams(window.location.search);
const vcode = urlParams.get('vcode');

async function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: { lat: 7.8731, lng: 80.7718 },
    fullscreenControl: false,
    streetViewControl: false
  });

  if (!vcode) return alert("No V‑Code provided.");
  const bookingRef = doc(db, 'confirmedBookings', vcode);
  const snap = await getDoc(bookingRef);
  if (!snap.exists()) return alert("Booking not found.");

  const { from, to, route } = snap.data();
  document.getElementById('header-info').textContent = `Bus #${route} • ${from} → ${to}`;

  const geocoder = new google.maps.Geocoder();
  [fromLoc, toLoc] = await Promise.all(['from','to'].map(key =>
    new Promise(res => geocoder.geocode({ address: snap.data()[key] }, (r,s) =>
      res(s==='OK' ? r[0].geometry.location : null)
    ))
  ));
  if (!fromLoc || !toLoc) return alert("Couldn’t geocode stops.");

  const iconOpts = size => ({
    url: size === 'from' ? 'images/f.png' : 'images/t.png',
    scaledSize: new google.maps.Size(32, 32)
  });
  new google.maps.Marker({ map, position: fromLoc, icon: iconOpts('from'), title: 'Pickup' });
  new google.maps.Marker({ map, position: toLoc,   icon: iconOpts('to'),   title: 'Drop' });

  const bounds = new google.maps.LatLngBounds();
  [fromLoc, toLoc].forEach(p => bounds.extend(p));
  map.fitBounds(bounds, 100);
  document.getElementById('info-bar').textContent = `${from} → ${to}`;

  const directionsService = new google.maps.DirectionsService();
  busRouteRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#ff6b00', strokeWeight: 6 }
  });
  directionsService.route({
    origin: fromLoc,
    destination: toLoc,
    travelMode: google.maps.TravelMode.DRIVING
  }, (res, status) => {
    if (status === 'OK') busRouteRenderer.setDirections(res);
  });

  // --- Exclusive tracking role ---
  const data = snap.data() || {};
  const activeTracker = data.activeTracker;
  const startBtn = document.getElementById('btn-start-journey');
  const liveBtn  = document.getElementById('btn-track-live');

  if (!activeTracker) {
    startBtn.style.display = 'block';
    liveBtn.style.display  = 'none';
    startBtn.addEventListener('click', async () => {
      await setDoc(bookingRef, { activeTracker: clientId }, { merge: true });
      startBtn.style.display = 'none';
      liveBtn.style.display  = 'block';
    });

  } else if (activeTracker === clientId) {
    startBtn.style.display = 'none';
    liveBtn.style.display  = 'block';
  } else {
    startBtn.style.display = 'none';
    liveBtn.style.display  = 'none';
    subscribeToLive(activeTracker);
  }

  // --- Live location toggle ---
  liveBtn.addEventListener('click', async () => {
    if (!isTrackingLive) {
      beginPublishing();
      liveBtn.textContent = 'Stop Live Tracking';
    } else {
      stopPublishing();
      await updateDoc(bookingRef, { activeTracker: null });
      liveBtn.textContent = 'Track My Live Location';
    }
  });

  // --- Bus Tracking Button ---
  const busBtn = document.getElementById('btn-track-bus');
  busBtn.addEventListener('click', () => {
    if (busMarker) {
      // stop tracking
      clearInterval(busAnimInterval);
      busMarker.setMap(null);
      busMarker = null;
      busBtn.textContent = 'Track Bus';
    } else {
      // start tracking
      const startLat = fromLoc.lat() + 0.005;
      const startLng = fromLoc.lng() + 0.005;
      busMarker = new google.maps.Marker({
        map,
        position: { lat: startLat, lng: startLng },
        icon: {
          url: 'images/bus.png',
          scaledSize: new google.maps.Size(42, 42)
        },
        title: 'Bus'
      });
      busBtn.textContent = 'Stop Tracking Bus';
      const steps = 100;
      let step = 10;
      const deltaLat = (fromLoc.lat() - startLat) / steps;
      const deltaLng = (fromLoc.lng() - startLng) / steps;
      busAnimInterval = setInterval(() => {
        if (step >= steps) {
          clearInterval(busAnimInterval);
          return;
        }
        const pos = busMarker.getPosition();
        busMarker.setPosition({
          lat: pos.lat() + deltaLat,
          lng: pos.lng() + deltaLng
        });
        step++;
      }, 100);
    }
  });

  document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = 'journey.html';
  });
}

function beginPublishing() {
  isTrackingLive = true;
  let firstUpdate = true;
  watchId = navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const liveRef = doc(db, 'confirmedBookings', vcode, 'liveLocations', clientId);
    setDoc(liveRef, { lat, lng, ts: serverTimestamp() });
    const posLatLng = new google.maps.LatLng(lat, lng);
    if (!liveUserMarker) {
      liveUserMarker = new google.maps.Marker({
        map,
        position: posLatLng,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#d50000', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
        title: "My Live Location"
      });
    } else {
      liveUserMarker.setPosition(posLatLng);
    }
    if (firstUpdate) {
      map.panTo(posLatLng); // center only first time
      firstUpdate = false;
    }
  }, err => console.warn(err), { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 });
}

function stopPublishing() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (liveUserMarker) {
    liveUserMarker.setMap(null);
    liveUserMarker = null;
  }
  isTrackingLive = false;
}

function subscribeToLive(trackerId) {
  const liveRef = doc(db, 'confirmedBookings', vcode, 'liveLocations', trackerId);
  onSnapshot(liveRef, snap => {
    if (!snap.exists()) return;
    const { lat, lng } = snap.data();
    const pos = new google.maps.LatLng(lat, lng);
    if (!liveUserMarker) {
      liveUserMarker = new google.maps.Marker({
        map,
        position: pos,
        title: 'Tracking Child',
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillOpacity: 1, fillColor: '#d50000', strokeWeight: 2 }
      });
    } else {
      liveUserMarker.setPosition(pos);
    }
  });
}

window.onload = initMap;



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


