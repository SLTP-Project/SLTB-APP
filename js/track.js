import { db } from './firebaseConfig.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let map, userMarker, liveUserMarker;
let busRouteRenderer, userToPickupLine, liveLineToDrop;
let fromLoc, toLoc;

let childWatchId = null;
const startBtn = document.getElementById('btn-start-journey');

startBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  // Toggle on/off
  if (childWatchId !== null) {
    navigator.geolocation.clearWatch(childWatchId);
    childWatchId = null;
    startBtn.textContent = 'Start My Journey';
  } else {
    childWatchId = navigator.geolocation.watchPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      // push into Firestore under confirmedBookings/{vcode}.livePosition
      await updateDoc(doc(db, 'confirmedBookings', vcode), {
        livePosition: { lat: latitude, lng: longitude, timestamp: Date.now() }
      });
    }, err => console.warn(err), { enableHighAccuracy: true });
    startBtn.textContent = 'Stop My Journey';
  }
});

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
  const snap = await getDoc(doc(db, 'confirmedBookings', vcode));
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

  userToPickupLine = new google.maps.Polyline({
    map,
    strokeColor: '#ff6b00',
    strokeOpacity: 0.8,
    strokeWeight: 4,
    path: []
  });

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(pos => {
      const latlng = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      if (!userMarker) {
        userMarker = new google.maps.Marker({
          position: latlng,
          map,
          title: "You are here",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ff6b00',
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 2
          }
        });
      } else {
        userMarker.setPosition(latlng);
      }
      userToPickupLine.setPath([latlng, fromLoc]);
    }, err => console.warn(err), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    });
  }

  document.getElementById('btn-center')?.addEventListener('click', () => {
    if (userMarker) map.panTo(userMarker.getPosition());
  });

  // LIVE TRACK BUTTON
  document.getElementById('btn-track-live').addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const userPos = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);

        if (!liveUserMarker) {
          liveUserMarker = new google.maps.Marker({
            map,
            position: userPos,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#d50000',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2
            },
            title: "Live You"
          });
        } else {
          liveUserMarker.setPosition(userPos);
        }

        // Red line from user → drop
        if (!liveLineToDrop) {
          liveLineToDrop = new google.maps.Polyline({
            map,
            strokeColor: '#d50000',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            path: [userPos, toLoc]
          });
        } else {
          liveLineToDrop.setPath([userPos, toLoc]);
        }

        // Show distance
        const distKm = google.maps.geometry.spherical.computeDistanceBetween(userPos, toLoc) / 1000;
        alert(`Distance to drop: ${distKm.toFixed(2)} km`);

        map.panTo(userPos);
      }, err => {
        alert("Unable to get live location");
        console.warn(err);
      }, {
        enableHighAccuracy: true,
        timeout: 7000
      });
    }
  });
}

document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = 'journey.html';
});

window.onload = initMap;
