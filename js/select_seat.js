// js/select_seat.js
// Must be loaded via <script type="module">

import { db } from './firebaseConfig.js';
import {
  doc,
  getDoc,
  // setDoc, updateDoc, arrayUnion  // not needed here
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// 1. Toggle navigation drawer open/close (same as buslist.js)
const menuBtn = document.getElementById("menu-btn");
const navDrawer = document.getElementById("nav-drawer");
if (menuBtn) {
  menuBtn.addEventListener("click", () => {
    navDrawer.classList.toggle("open");
  });
}
// Close the drawer when clicking outside
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

// 2. “Go Back” button: use history.back() so we return to Bus List
const backBtn = document.getElementById("back-btn");
if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.history.back();
  });
}

// 3. Highlight bottom nav items when clicked (optional)
document.querySelectorAll(".nav-item-bottom").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item-bottom").forEach((el) =>
      el.classList.remove("active")
    );
    item.classList.add("active");
    const label = item.querySelector(".nav-label-bottom")?.textContent.trim();
    if (label === "Journey") {
      window.location.href = "journey.html";
    } else if (label === "Home") {
      window.location.href = "home.html";
    } else if (label === "Alert") {
      window.location.href = "alert.html";
    } else if (label === "Account") {
      window.location.href = "account.html";
    }
  });
});

// Utility: parse query parameters
function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

// Utility: format a Date object to "DD Mon" (e.g. "01 Jun")
function formatDateShort(d) {
  const dd = d.getDate().toString().padStart(2, '0');
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = monthNames[d.getMonth()];
  return `${dd} ${mon}`;
}
// Utility: format full date "DD / Mon / YYYY"
function formatDateFull(d) {
  const dd = d.getDate().toString().padStart(2, '0');
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = monthNames[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd} / ${mon} / ${yyyy}`;
}

// 4. On DOMContentLoaded: read params and populate first box, update header, fetch booked seats
document.addEventListener("DOMContentLoaded", async () => {
  const params = getQueryParams();
  const fromParam = params.get('from') || ""; // e.g. "Killinochchi"
  const toParam = params.get('to') || "";
  const dateParam = params.get('date') || ""; // "YYYY-MM-DD"
  const routeParam = params.get('route') || ""; // e.g. "02"

  // Parse baseDate from dateParam
  let baseDate = null;
  if (dateParam) {
    const parts = dateParam.split('-');
    if (parts.length === 3) {
      const yyyy = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10) - 1;
      const dd = parseInt(parts[2], 10);
      baseDate = new Date(yyyy, mm, dd);
    }
  }

  // 5. Define stops & times mapping for known routes.
  //    Adjust these arrays to match your real data.
  const stopsMap = {
    "02": ["Jaffna","Killinochchi","Negombo","Colombo"],
    "20": ["Jaffna","Killinochchi","Negombo"],
    "222": ["Killinochchi","Negombo"],
    "202": ["Killinochchi","Negombo","Colombo"],
    // Add more route mappings here if needed
  };
  const timesMap = {
    "02": ["20:00","21:00","01:00","04:00"],
    "20": ["04:00","20:00","01:00"],
    "222": ["20:00","01:00"],
    "202": ["20:00","21:00","04:00"],
    // Add corresponding times arrays here
  };
  const fareMap = {
    "02": "1500 LKR / seat",
    "20": "1500 LKR / seat",
    "222": "1500 LKR / seat",
    "202": "1500 LKR / seat",
    // Add fare per route if different
  };
  const availabilityMap = {
    "02": 40,
    "20": 9,
    "222": 40,
    "202": 0,
    // Add availability counts if needed
  };

  // Get the first box container
  const routeBoxBody = document.getElementById("route-box-body");
  // Clear existing content
  if (routeBoxBody) routeBoxBody.innerHTML = "";

  // Validate routeParam presence in our map
  if (!routeParam || !stopsMap[routeParam]) {
    // If invalid route, show error message
    if (routeBoxBody) {
      const p = document.createElement("p");
      p.style.textAlign = "center";
      p.style.color = "#555";
      p.textContent = "Invalid route selected.";
      routeBoxBody.appendChild(p);
    }
  } else if (!fromParam || !toParam || !baseDate) {
    // Missing parameters
    if (routeBoxBody) {
      const p = document.createElement("p");
      p.style.textAlign = "center";
      p.style.color = "#555";
      p.textContent = "Missing route details.";
      routeBoxBody.appendChild(p);
    }
  } else {
    // Build first box content dynamically with correct direction handling
    const stops = stopsMap[routeParam]; // e.g. ["Jaffna","Killinochchi","Negombo","Colombo"]
    const times = timesMap[routeParam] || [];

    // Find indices in the forward array
    const idxFromF = stops.findIndex(s => s.toLowerCase() === fromParam.toLowerCase());
    const idxToF   = stops.findIndex(s => s.toLowerCase() === toParam.toLowerCase());

    // If either not found, show error
    if (idxFromF === -1 || idxToF === -1) {
      if (routeBoxBody) {
        const p = document.createElement("p");
        p.style.textAlign = "center";
        p.style.color = "#555";
        p.textContent = "Selected From/To not on this route.";
        routeBoxBody.appendChild(p);
      }
    } else {
      // Determine display order: if forward direction (from earlier to later), keep as-is;
      // if reverse (from later to earlier), reverse the stops array for display
      let fullStops = [];
      let idxFrom, idxTo;
      if (idxFromF <= idxToF) {
        // forward direction
        fullStops = stops.slice();
        idxFrom = idxFromF;
        idxTo = idxToF;
      } else {
        // reverse direction
        fullStops = stops.slice().reverse();
        // recompute indices in reversed array
        idxFrom = fullStops.findIndex(s => s.toLowerCase() === fromParam.toLowerCase());
        idxTo   = fullStops.findIndex(s => s.toLowerCase() === toParam.toLowerCase());
        // Now idxFrom < idxTo in this reversed array
      }

      const nStops = fullStops.length;

      // 5a. Build stops-row
      const stopsRow = document.createElement("div");
      stopsRow.className = "stops-row";
      fullStops.forEach(stopName => {
        const span = document.createElement("span");
        span.className = "stop";
        span.textContent = stopName;
        stopsRow.appendChild(span);
      });
      routeBoxBody.appendChild(stopsRow);

      // 5b. Build timeline
      const timelineDiv = document.createElement("div");
      timelineDiv.className = "timeline";
      // timeline-line
      const lineFull = document.createElement("div");
      lineFull.className = "timeline-line";
      timelineDiv.appendChild(lineFull);
      // timeline-active-line: compute left% and width%
      if (nStops > 1) {
        const activeLine = document.createElement("div");
        activeLine.className = "timeline-active-line";
        const leftPct = (Math.min(idxFrom, idxTo) / (nStops - 1)) * 100;
        const widthPct = ((Math.max(idxFrom, idxTo) - Math.min(idxFrom, idxTo)) / (nStops - 1)) * 100;
        activeLine.style.left = `${leftPct}%`;
        activeLine.style.width = `${widthPct}%`;
        timelineDiv.appendChild(activeLine);
      }
      // timeline-dots
      const dotsContainer = document.createElement("div");
      dotsContainer.className = "timeline-dots";
      fullStops.forEach((stopName, idx) => {
        const dotCont = document.createElement("div");
        dotCont.className = "dot-container";
        // If this is from stop, insert f.png; if to stop, insert t.png
        if (idx === idxFrom) {
          const img = document.createElement("img");
          img.src = "images/f.png";
          img.alt = "from-icon";
          img.className = "timeline-icon";
          dotCont.appendChild(img);
        }
        if (idx === idxTo) {
          const img = document.createElement("img");
          img.src = "images/t.png";
          img.alt = "to-icon";
          img.className = "timeline-icon";
          dotCont.appendChild(img);
        }
        // Dot itself
        const dot = document.createElement("div");
        dot.className = "dot";
        // Color orange if idx between idxFrom and idxTo inclusive, else default
        if (idx >= Math.min(idxFrom, idxTo) && idx <= Math.max(idxFrom, idxTo)) {
          dot.style.background = "#ff6b00";
        } else {
          dot.style.background = "#102542";
        }
        dotCont.appendChild(dot);
        dotsContainer.appendChild(dotCont);
      });
      timelineDiv.appendChild(dotsContainer);
      routeBoxBody.appendChild(timelineDiv);

      // 5c. Build times & dates row
      const timesDiv = document.createElement("div");
      timesDiv.className = "times";
      if (times.length === stops.length) {
        // Compute date rollover logic in the forward array order first:
        // Build an array timeDateArr indexed by the original stops array:
        const timeDateArr = [];
        let currDateRoll = new Date(baseDate.getTime());
        let prevHour = null;
        times.forEach((timeStr, idx) => {
          const [hhStr, mmStr] = timeStr.split(':');
          const hh = parseInt(hhStr, 10);
          if (idx === 0) {
            currDateRoll = new Date(baseDate.getTime());
          } else {
            if (hh < prevHour) {
              currDateRoll.setDate(currDateRoll.getDate() + 1);
            }
          }
          prevHour = hh;
          timeDateArr[idx] = {
            time: timeStr,
            dateStr: formatDateShort(new Date(currDateRoll.getTime()))
          };
        });
        // Now for each stop in fullStops, find its index in original stops[] to pick time/date
        fullStops.forEach(stopName => {
          // find index in forward stops array
          let idxOrig = stops.findIndex(s => s.toLowerCase() === stopName.toLowerCase());
          if (idxOrig === -1) {
            // it must be from reversed; so compute original index as:
            // stops reversed index = fullStops index; but simpler: find in original:
            idxOrig = stops.findIndex(s => s.toLowerCase() === stopName.toLowerCase());
          }
          let timeText = "--:--";
          let dateText = formatDateShort(new Date(baseDate.getTime()));
          if (idxOrig !== -1 && timeDateArr[idxOrig]) {
            timeText = timeDateArr[idxOrig].time;
            dateText = timeDateArr[idxOrig].dateStr;
          }
          const ti = document.createElement("div");
          ti.className = "time-item";
          const spanTime = document.createElement("span");
          spanTime.className = "time";
          spanTime.textContent = timeText;
          const br = document.createElement("br");
          const spanDate = document.createElement("span");
          spanDate.className = "date";
          spanDate.textContent = dateText;
          ti.appendChild(spanTime);
          ti.appendChild(br);
          ti.appendChild(spanDate);
          timesDiv.appendChild(ti);
        });
      } else {
        // If times length differs, still create placeholders
        fullStops.forEach(() => {
          const ti = document.createElement("div");
          ti.className = "time-item";
          const spanTime = document.createElement("span");
          spanTime.className = "time";
          spanTime.textContent = "--:--";
          const br = document.createElement("br");
          const spanDate = document.createElement("span");
          spanDate.className = "date";
          spanDate.textContent = formatDateShort(baseDate);
          ti.appendChild(spanTime);
          ti.appendChild(br);
          ti.appendChild(spanDate);
          timesDiv.appendChild(ti);
        });
      }
      routeBoxBody.appendChild(timesDiv);

      // 5d. Divider
      const divider = document.createElement("div");
      divider.className = "divider";
      routeBoxBody.appendChild(divider);

      // 5e. Fare
      const fareDiv = document.createElement("div");
      fareDiv.className = "fare";
      fareDiv.textContent = fareMap[routeParam] || "1500 LKR / seat";
      routeBoxBody.appendChild(fareDiv);

      // 5f. Availability & closing info
      const availDiv = document.createElement("div");
      availDiv.className = "availability";
      const availCount = availabilityMap[routeParam];
      // Closing at 18:00 on the baseDate
      const closingTime = "18:00";
      const closingDateShort = formatDateShort(baseDate);
      let availText = "";
      if (typeof availCount === "number") {
        availText = `${availCount} Seats available – Closing : ${closingDateShort}, ${closingTime}`;
      } else {
        availText = `Seats info unavailable – Closing : ${closingDateShort}, ${closingTime}`;
      }
      availDiv.textContent = availText;
      routeBoxBody.appendChild(availDiv);
    }
  }

  // 6. Update Seating Plan header with actual route number
  const routeNumText = document.getElementById("route-number-text");
  if (routeParam && routeNumText) {
    routeNumText.textContent = `Seating Plan SLTB Bus – Route no : ${routeParam}`;
  }

  // 7. Fetch existing booked seats from Firestore for this route+date
  // Collection: "bookings", Document ID: `${routeParam}_${dateParam}`
  let bookedSeats = [];
  if (routeParam && dateParam) {
    try {
      const bookingDocRef = doc(db, 'bookings', `${routeParam}_${dateParam}`);
      const bookingSnap = await getDoc(bookingDocRef);
      if (bookingSnap.exists()) {
        const data = bookingSnap.data();
        if (Array.isArray(data.seats)) {
          bookedSeats = data.seats.map(x => String(x)); // array of seat numbers as strings
        }
      }
    } catch (err) {
      console.error("Error fetching booked seats:", err);
    }
  }
  // 8. Mark those seats as booked in the grid
  bookedSeats.forEach(seatNum => {
    const btn = document.querySelector(`.seating-grid .seat[data-seat="${seatNum}"]`);
    if (btn) {
      btn.classList.remove("available", "processing");
      btn.classList.add("booked");
      btn.disabled = true;
    }
  });

  // 9. Seat‐selection logic (only for those still available)
  document.querySelectorAll(".seating-grid .seat.available").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("processing")) {
        btn.classList.remove("processing");
        btn.classList.add("available");
      } else {
        btn.classList.remove("available");
        btn.classList.add("processing");
      }
    });
  });

  // 10. Seat-modal logic
  const seatModal = document.getElementById("seat-modal");
  const seatModalOkBtn = document.getElementById("seat-modal-ok-btn");
  function showSeatModal(message) {
    const msgElem = document.getElementById("seat-modal-message");
    if (msgElem) msgElem.textContent = message;
    if (seatModal) {
      seatModal.style.display = "flex";
      seatModal.setAttribute("aria-hidden", "false");
    }
  }
  function hideSeatModal() {
    if (seatModal) {
      seatModal.style.display = "none";
      seatModal.setAttribute("aria-hidden", "true");
    }
  }
  if (seatModalOkBtn) {
    seatModalOkBtn.addEventListener("click", () => {
      hideSeatModal();
    });
  }

  // 11. “CONTINUE” button logic: store pendingBooking in localStorage, then redirect
  const continueBtn = document.getElementById("continue-btn");
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      const selectedSeats = Array.from(
        document.querySelectorAll(".seating-grid .seat.processing")
      ).map(btn => btn.getAttribute("data-seat"));

      if (selectedSeats.length === 0) {
        showSeatModal("Please select at least one seat before continuing.");
      } else {
        // Compute departure time: time at fromParam index in the forward array
        let departureTime = null;
        if (timesMap[routeParam] && stopsMap[routeParam]) {
          const stopsArr = stopsMap[routeParam];
          const timesArr = timesMap[routeParam];
          const idxFromOriginal = stopsArr.findIndex(s => s.toLowerCase() === fromParam.toLowerCase());
          if (idxFromOriginal !== -1 && idxFromOriginal < timesArr.length) {
            departureTime = timesArr[idxFromOriginal]; // e.g. "21:00"
          }
        }
        // Build pendingBooking object
        const pendingBooking = {
          route: routeParam,
          date: dateParam,
          from: fromParam,
          to: toParam,
          seats: selectedSeats,
          departureTime: departureTime // may be null if cannot compute
          // personal details will be added in personal_details page
        };
        // Store in localStorage
        localStorage.setItem("pendingBooking", JSON.stringify(pendingBooking));
        // Redirect to personal_details.html
        window.location.href = "personal_details.html";
      }
    });
  }
});
