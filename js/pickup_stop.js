// js/pickup_stop.js
// Must be loaded via <script type="module">

import { db } from './firebaseConfig.js';
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

let map;
let pickupAutocomplete, dropAutocomplete;
let pickupMarker = null, dropMarker = null;
let directionsService, directionsRenderer;
let geocoder;

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-btn");
  const navDrawer = document.getElementById("nav-drawer");
  const backBtn = document.getElementById("back-btn");
  const pickupInput = document.getElementById("pickup-input");
  const dropInput = document.getElementById("drop-input");
  const pickupIcon = document.getElementById("pickup-icon");
  const dropIcon = document.getElementById("drop-icon");
  const nextBtn = document.getElementById("next-btn");
  const pickupLabel = document.getElementById("pickup-label");
  const dropLabel = document.getElementById("drop-label");

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

  // Back button: return to payment_successful.html
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "payment_successful.html";
    });
  }

  // Initialize Google Map and Autocomplete etc.
  function initMap() {
    geocoder = new google.maps.Geocoder();

    // Default center: Sri Lanka approx center
    const defaultCenter = { lat: 7.8731, lng: 80.7718 };
    map = new google.maps.Map(document.getElementById("map"), {
      center: defaultCenter,
      zoom: 7,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      zoomControl: false, // we use custom zoom controls
    });

    // Directions
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
    });
    directionsRenderer.setMap(map);

    // Autocomplete options: general, but we'll bias later
    const options = {
      fields: ["place_id", "geometry", "name", "formatted_address"],
      types: ["establishment", "geocode"],
      // bounds will be set after we know from/to
    };
    pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, options);
    dropAutocomplete = new google.maps.places.Autocomplete(dropInput, options);

    pickupAutocomplete.addListener("place_changed", onPickupPlaceChanged);
    dropAutocomplete.addListener("place_changed", onDropPlaceChanged);

    // Setup custom map controls (zoom/pan buttons)
    setupMapControls();
  }

  function onPickupPlaceChanged() {
    const place = pickupAutocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) {
      console.warn("No geometry for pickup place");
      return;
    }
    const loc = place.geometry.location;
    if (pickupMarker) {
      pickupMarker.setPosition(loc);
    } else {
      pickupMarker = new google.maps.Marker({
        map,
        position: loc,
        icon: {
          url: "images/f.png",
          scaledSize: new google.maps.Size(32, 32),
        }
      });
    }
    adjustMapViewport();
    drawRouteIfPossible();
    checkNextEnabled();
  }

  function onDropPlaceChanged() {
    const place = dropAutocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) {
      console.warn("No geometry for drop place");
      return;
    }
    const loc = place.geometry.location;
    if (dropMarker) {
      dropMarker.setPosition(loc);
    } else {
      dropMarker = new google.maps.Marker({
        map,
        position: loc,
        icon: {
          url: "images/t.png",
          scaledSize: new google.maps.Size(32, 32),
        }
      });
    }
    adjustMapViewport();
    drawRouteIfPossible();
    checkNextEnabled();
  }

  function adjustMapViewport() {
    if (pickupMarker && dropMarker) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pickupMarker.getPosition());
      bounds.extend(dropMarker.getPosition());
      map.fitBounds(bounds, 100);
    } else if (pickupMarker) {
      map.panTo(pickupMarker.getPosition());
      map.setZoom(14);
    } else if (dropMarker) {
      map.panTo(dropMarker.getPosition());
      map.setZoom(14);
    }
  }

  function drawRouteIfPossible() {
    if (pickupMarker && dropMarker) {
      const request = {
        origin: pickupMarker.getPosition(),
        destination: dropMarker.getPosition(),
        travelMode: google.maps.TravelMode.DRIVING,
      };
      directionsService.route(request, (result, status) => {
        if (status === "OK" && result) {
          directionsRenderer.setDirections(result);
        } else {
          console.warn("Directions request failed:", status);
        }
      });
    } else {
      directionsRenderer.setDirections({ routes: [] });
    }
  }

  // Read from Firestore or pendingBooking to get from/to strings
  async function loadFromFirestore() {
    const vcode = localStorage.getItem("lastBookingVcode");
    if (!vcode) return null;
    try {
      const bookingDocRef = doc(db, 'confirmedBookings', vcode);
      const snap = await getDoc(bookingDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.from && data.to) {
          return { from: data.from, to: data.to };
        }
      }
    } catch (err) {
      console.error("Error fetching booking from Firestore in pickup_stop:", err);
    }
    return null;
  }

  function loadFromPendingBooking() {
    try {
      const pendingStr = localStorage.getItem("pendingBooking");
      if (pendingStr) {
        const pendingBooking = JSON.parse(pendingStr);
        if (pendingBooking.from && pendingBooking.to) {
          return { from: pendingBooking.from, to: pendingBooking.to };
        }
      }
    } catch (err) {
      console.error("Error reading pendingBooking in pickup_stop:", err);
    }
    return null;
  }

  // After we know from/to strings, we:
  // 1) Set the labels/placeholder
  // 2) Geocode 'from' to LatLng, then bias pickupAutocomplete bounds around that location
  // 3) Similarly for 'to' with dropAutocomplete
  async function initializeLabelsAndBias() {
    let locs = await loadFromFirestore();
    if (!locs) {
      locs = loadFromPendingBooking();
    }
    let fromLoc = locs?.from || null;
    let toLoc = locs?.to || null;

    if (fromLoc) {
      pickupLabel.textContent = fromLoc;
      if (pickupInput) {
        pickupInput.placeholder = `Pickup near ${fromLoc}`;
      }
      // Geocode fromLoc and bias autocomplete
      geocoder.geocode({ address: fromLoc }, (results, status) => {
        if (status === "OK" && results[0]) {
          const location = results[0].geometry.location;
          // Create a circle of radius ~20km to bias autocomplete
          const circle = new google.maps.Circle({
            center: location,
            radius: 20000
          });
          pickupAutocomplete.setBounds(circle.getBounds());
          pickupAutocomplete.setOptions({ strictBounds: false });
          // Center map initially on this location
          map.panTo(location);
          map.setZoom(12);
        } else {
          console.warn("Geocode failed for fromLoc:", status);
        }
      });
    } else {
      pickupLabel.textContent = "Pickup stop";
      if (pickupInput) {
        pickupInput.placeholder = "Select a nearby bus stop";
      }
    }

    if (toLoc) {
      dropLabel.textContent = toLoc;
      if (dropInput) {
        dropInput.placeholder = `Drop near ${toLoc}`;
      }
      // Geocode toLoc and bias autocomplete
      geocoder.geocode({ address: toLoc }, (results, status) => {
        if (status === "OK" && results[0]) {
          const location = results[0].geometry.location;
          const circle = new google.maps.Circle({
            center: location,
            radius: 20000
          });
          dropAutocomplete.setBounds(circle.getBounds());
          dropAutocomplete.setOptions({ strictBounds: false });
        } else {
          console.warn("Geocode failed for toLoc:", status);
        }
      });
    } else {
      dropLabel.textContent = "Drop stop";
      if (dropInput) {
        dropInput.placeholder = "Where are you going?";
      }
    }
  }

  // Input listeners: enable drop only after pickup typed; clear markers if cleared
  function setupInputListeners() {
    if (pickupInput) {
      pickupInput.addEventListener("input", () => {
        const val = pickupInput.value.trim();
        if (val.length > 0) {
          dropInput.disabled = false;
        } else {
          // Clear pickup marker, drop marker, route
          if (pickupMarker) {
            pickupMarker.setMap(null);
            pickupMarker = null;
          }
          if (dropMarker) {
            dropMarker.setMap(null);
            dropMarker = null;
          }
          directionsRenderer.setDirections({ routes: [] });
          dropInput.value = "";
          dropInput.disabled = true;
        }
        checkNextEnabled();
      });
    }
    if (dropInput) {
      dropInput.addEventListener("input", () => {
        const val = dropInput.value.trim();
        if (val.length === 0) {
          if (dropMarker) {
            dropMarker.setMap(null);
            dropMarker = null;
          }
          directionsRenderer.setDirections({ routes: [] });
        }
        checkNextEnabled();
      });
    }
  }

  function checkNextEnabled() {
    if (
      pickupInput && dropInput &&
      pickupInput.value.trim().length > 0 &&
      dropInput.value.trim().length > 0 &&
      pickupMarker && dropMarker
    ) {
      nextBtn.disabled = false;
    } else {
      nextBtn.disabled = true;
    }
  }

  // Next button: store chosen stops and go to final_info.html
  function setupNextButton() {
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const pu = pickupInput.value.trim();
        const dr = dropInput.value.trim();
        if (pu) localStorage.setItem('pickupStop', pu);
        if (dr) localStorage.setItem('dropStop', dr);
        window.location.href = "final_info.html";
      });
    }
  }

  // Setup custom map controls
  function setupMapControls() {
    const zoomInBtn = document.getElementById("zoom-in");
    const zoomOutBtn = document.getElementById("zoom-out");
    const panUpBtn = document.getElementById("pan-up");
    const panDownBtn = document.getElementById("pan-down");
    const panLeftBtn = document.getElementById("pan-left");
    const panRightBtn = document.getElementById("pan-right");
    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => {
        const curr = map.getZoom() || 0;
        map.setZoom(curr + 1);
      });
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => {
        const curr = map.getZoom() || 0;
        map.setZoom(curr - 1);
      });
    }
    // Pan by fixed pixel offsets
    const PAN_PIXELS = 100;
    if (panUpBtn) {
      panUpBtn.addEventListener("click", () => {
        map.panBy(0, -PAN_PIXELS);
      });
    }
    if (panDownBtn) {
      panDownBtn.addEventListener("click", () => {
        map.panBy(0, PAN_PIXELS);
      });
    }
    if (panLeftBtn) {
      panLeftBtn.addEventListener("click", () => {
        map.panBy(-PAN_PIXELS, 0);
      });
    }
    if (panRightBtn) {
      panRightBtn.addEventListener("click", () => {
        map.panBy(PAN_PIXELS, 0);
      });
    }
  }

  // Initialize everything
  function initializePage() {
    if (typeof google === "undefined" || !google.maps) {
      console.error("Google Maps JS API not loaded.");
      return;
    }
    initMap();
    initializeLabelsAndBias();
    setupInputListeners();
    setupNextButton();
    // Map controls are set up in initMap via setupMapControls()
  }

  // Because the Maps script is loaded before this, google.maps is available:
  if (window.google && google.maps) {
    initializePage();
  } else {
    // If needed, can assign window.initPickupMap = initializePage;
    console.error("Google Maps not available.");
  }
});
