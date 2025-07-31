/**
 * personal_details.js
 * 
 * 1. Reads pendingBooking from localStorage (route/date/from/to/seats/departureTime),
 * 2. Populates Box 1 (#route-box-body) using the same logic/structure as select_seat.js,
 *    so the design matches exactly (including reversal of stops for reverse direction).
 * 3. On Proceed To Pay: validates form, merges personal details into pendingBooking, redirects to payment.html.
 */

/** Toggle navigation drawer open/close */
const menuBtn_pd = document.getElementById("menu-btn");
const navDrawer_pd = document.getElementById("nav-drawer");
if (menuBtn_pd) {
  menuBtn_pd.addEventListener("click", () => {
    navDrawer_pd.classList.toggle("open");
  });
}
document.addEventListener("click", (e) => {
  if (
    navDrawer_pd &&
    !navDrawer_pd.contains(e.target) &&
    menuBtn_pd &&
    !menuBtn_pd.contains(e.target) &&
    navDrawer_pd.classList.contains("open")
  ) {
    navDrawer_pd.classList.remove("open");
  }
});

/** “Go Back” button: returns to select_seat.html */
const backBtn_pd = document.getElementById("back-btn");
if (backBtn_pd) {
  backBtn_pd.addEventListener("click", () => {
    window.history.back();
  });
}

/** Highlight bottom nav items when clicked & navigation */
document.querySelectorAll(".nav-item-bottom").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item-bottom").forEach(el => el.classList.remove("active"));
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

/** Utility: format a Date object to "DD Mon" (e.g. "01 Jun") */
function formatDateShort(d) {
  const dd = d.getDate().toString().padStart(2, '0');
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = monthNames[d.getMonth()];
  return `${dd} ${mon}`;
}

// On load: read pendingBooking and populate Box 1 (#route-box-body)
document.addEventListener("DOMContentLoaded", () => {
  
  const pendingStr = localStorage.getItem("pendingBooking");
  if (!pendingStr) {
    console.warn("No pendingBooking found; redirecting to select seat.");
    window.location.href = "select_seat.html";
    return;
  }
  let pendingBooking;
  try {
    pendingBooking = JSON.parse(pendingStr);
  } catch (e) {
    console.error("Error parsing pendingBooking:", e);
    localStorage.removeItem("pendingBooking");
    window.location.href = "select_seat.html";
    return;
  }
  const { route, date, from, to, seats, departureTime } = pendingBooking;
  if (!route || !date || !from || !to || !Array.isArray(seats) || seats.length === 0) {
    console.warn("Incomplete pendingBooking data:", pendingBooking);
    localStorage.removeItem("pendingBooking");
    window.location.href = "select_seat.html";
    return;
  }

  // ----- Render Box 1 identically to select_seat.js logic -----
  // Copy the same maps/config from select_seat.js:
  const stopsMap = {
    "02": ["Jaffna","Killinochchi","Negombo","Colombo"],
    "20": ["Jaffna","Killinochchi","Negombo"],
    "222": ["Killinochchi","Negombo"],
    "202": ["Killinochchi","Negombo","Colombo"],
    // Add more route mappings if needed
  };
  const timesMap = {
    "02": ["20:00","21:00","01:00","04:00"],
    "20": ["04:00","20:00","01:00"],
    "222": ["20:00","01:00"],
    "202": ["20:00","21:00","04:00"],
    // Add corresponding times arrays
  };
  // const fareMap = {
  //   "02": "1500 LKR / seat",
  //   "20": "1500 LKR / seat",
  //   "222": "1500 LKR / seat",
  //   "202": "1500 LKR / seat",
  //   // Add fare per route if different
  // };
  const fareMap = {
  "02": 1376,
  "20": 1376,
  "222": 1376,
  "202": 1376,
  // … all values here are “LKR per seat” as Numbers
};

  const availabilityMap = {
    "02": 40,
    "20": 9,
    "222": 40,
    "202": 0,
    // Add availability counts if needed
  };

  // Target container:
  const routeBoxBody = document.getElementById("route-box-body");
  if (!routeBoxBody) return;
  routeBoxBody.innerHTML = "";  // clear placeholder

  // Parse baseDate from date string "YYYY-MM-DD"
  let baseDate = null;
  {
    const parts = date.split("-");
    if (parts.length === 3) {
      const yyyy = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10) - 1;
      const dd = parseInt(parts[2], 10);
      baseDate = new Date(yyyy, mm, dd);
    }
  }
  if (!stopsMap[route] || !baseDate) {
    // Cannot render properly
    const p = document.createElement("p");
    p.style.textAlign = "center";
    p.style.color = "#555";
    p.textContent = "Route details unavailable.";
    routeBoxBody.appendChild(p);
    return;
  }

  const stopsArr = stopsMap[route].slice(); // forward array
  const timesArr = timesMap[route] || [];

  // Find indices of from/to in forward array
  let idxFromF = stopsArr.findIndex(s => s.toLowerCase() === from.toLowerCase());
  let idxToF   = stopsArr.findIndex(s => s.toLowerCase() === to.toLowerCase());
  let fullStops;
  let idxFrom, idxTo;
  if (idxFromF === -1 || idxToF === -1) {
    // Maybe reversed
    fullStops = stopsArr.slice().reverse();
    idxFrom = fullStops.findIndex(s => s.toLowerCase() === from.toLowerCase());
    idxTo   = fullStops.findIndex(s => s.toLowerCase() === to.toLowerCase());
  } else {
    // Decide direction: if forward
    if (idxFromF <= idxToF) {
      fullStops = stopsArr.slice();
      idxFrom = idxFromF;
      idxTo   = idxToF;
    } else {
      // reverse direction
      fullStops = stopsArr.slice().reverse();
      idxFrom = fullStops.findIndex(s => s.toLowerCase() === from.toLowerCase());
      idxTo   = fullStops.findIndex(s => s.toLowerCase() === to.toLowerCase());
    }
  }

  if (idxFrom === -1 || idxTo === -1) {
    // Could not locate from/to in stops; show basic
    const p = document.createElement("p");
    p.style.textAlign = "center";
    p.style.color = "#555";
    p.textContent = `From: ${from}, To: ${to}`;
    routeBoxBody.appendChild(p);
  } else {
    // 1. Build stops-row
    const stopsRow = document.createElement("div");
    stopsRow.className = "stops-row";
    fullStops.forEach(stopName => {
      const span = document.createElement("span");
      span.className = "stop";
      span.textContent = stopName;
      stopsRow.appendChild(span);
    });
    routeBoxBody.appendChild(stopsRow);

    // 2. Build timeline
    const timelineDiv = document.createElement("div");
    timelineDiv.className = "timeline";
    // full line
    const lineFull = document.createElement("div");
    lineFull.className = "timeline-line";
    timelineDiv.appendChild(lineFull);
    // active segment
    if (fullStops.length > 1) {
      const activeLine = document.createElement("div");
      activeLine.className = "timeline-active-line";
      const startIdx = Math.min(idxFrom, idxTo);
      const endIdx = Math.max(idxFrom, idxTo);
      const denom = fullStops.length - 1;
      const leftPct = (startIdx / denom) * 100;
      const widthPct = ((endIdx - startIdx) / denom) * 100;
      activeLine.style.left = `${leftPct}%`;
      activeLine.style.width = `${widthPct}%`;
      timelineDiv.appendChild(activeLine);
    }
    // dots
    const dotsContainer = document.createElement("div");
    dotsContainer.className = "timeline-dots";
    fullStops.forEach((stopName, pos) => {
      const dotCont = document.createElement("div");
      dotCont.className = "dot-container";
      // f-icon
      if (pos === idxFrom) {
        const img = document.createElement("img");
        img.src = "images/f.png";
        img.alt = "from-icon";
        img.className = "timeline-icon";
        dotCont.appendChild(img);
      }
      // t-icon
      if (pos === idxTo) {
        const img = document.createElement("img");
        img.src = "images/t.png";
        img.alt = "to-icon";
        img.className = "timeline-icon";
        dotCont.appendChild(img);
      }
      // dot circle
      const dot = document.createElement("div");
      dot.className = "dot";
      if (pos >= Math.min(idxFrom, idxTo) && pos <= Math.max(idxFrom, idxTo)) {
        dot.style.background = "#ff6b00";
      } else {
        dot.style.background = "#102542";
      }
      dotCont.appendChild(dot);
      dotsContainer.appendChild(dotCont);
    });
    timelineDiv.appendChild(dotsContainer);
    routeBoxBody.appendChild(timelineDiv);

    // 3. Build times & dates row
    const timesDiv = document.createElement("div");
    timesDiv.className = "times";
    if (timesArr.length === stopsArr.length) {
      // Precompute date-rollover in forward order:
      const timeDateArr = [];
      let tempDate = new Date(baseDate.getTime());
      let prevH = null;
      timesArr.forEach((timeStr, idx) => {
        const [hhStr, mmStr] = timeStr.split(':');
        const hh = parseInt(hhStr, 10);
        if (idx === 0) {
          tempDate = new Date(baseDate.getTime());
        } else {
          if (hh < prevH) {
            tempDate.setDate(tempDate.getDate() + 1);
          }
        }
        prevH = hh;
        timeDateArr[idx] = {
          time: timeStr,
          dateStr: formatDateShort(new Date(tempDate.getTime()))
        };
      });
      // Now for each stop in fullStops, find its index in stopsArr to pick timeDateArr
      fullStops.forEach(stopName => {
        let idxOrig = stopsArr.findIndex(s => s.toLowerCase() === stopName.toLowerCase());
        if (idxOrig === -1) {
          // reversed: compute original index if needed
          const revIdx = stopsArr.slice().reverse().findIndex(s => s.toLowerCase() === stopName.toLowerCase());
          if (revIdx !== -1) {
            idxOrig = stopsArr.length - 1 - revIdx;
          }
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
      // fallback placeholders
      fullStops.forEach(() => {
        const ti = document.createElement("div");
        ti.className = "time-item";
        const spanTime = document.createElement("span");
        spanTime.className = "time";
        spanTime.textContent = "--:--";
        const br = document.createElement("br");
        const spanDate = document.createElement("span");
        spanDate.className = "date";
        spanDate.textContent = formatDateShort(new Date(baseDate.getTime()));
        ti.appendChild(spanTime);
        ti.appendChild(br);
        ti.appendChild(spanDate);
        timesDiv.appendChild(ti);
      });
    }
    routeBoxBody.appendChild(timesDiv);

    // 4. Divider
    const divider = document.createElement("div");
    divider.className = "divider";
    routeBoxBody.appendChild(divider);

    // 5. Fare
    const fareDiv = document.createElement("div");
    fareDiv.className = "fare";
    fareDiv.textContent = fareMap[route] || "";
    routeBoxBody.appendChild(fareDiv);

    // 6. Availability & closing info
    const availDiv = document.createElement("div");
    availDiv.className = "availability";
    const availCount = availabilityMap[route];
    const closingTime = "18:00";
    const closingDateShort = formatDateShort(new Date(baseDate.getTime()));
    let availText = "";
    if (typeof availCount === "number") {
      availText = `${availCount} Seats available – Closing : ${closingDateShort}, ${closingTime}`;
    } else {
      availText = `Seats info unavailable – Closing : ${closingDateShort}, ${closingTime}`;
    }
    routeBoxBody.appendChild(availDiv);
    availDiv.textContent = availText;

    // 7. Route number line (same styling as availability)
    const routeInfoDiv = document.createElement("div");
    routeInfoDiv.className = "availability";
    routeInfoDiv.textContent = `SLTB Bus - Route no : ${route}`;
    routeBoxBody.appendChild(routeInfoDiv);

    // 8. Seat number(s) line
    const seatInfoDiv = document.createElement("div");
    seatInfoDiv.className = "availability";
    seatInfoDiv.textContent = `Seat number - ${seats.join(", ")}`;
    routeBoxBody.appendChild(seatInfoDiv);
  }
  // ----- End of Box 1 rendering -----

   (function() {
    // number of seats booked
    const seatCount = seats.length;
    // per-seat fare (from your numeric fareMap)
    const perSeatFare = fareMap[route] || 0;
    // total bus fare
    const totalBusFare = perSeatFare * seatCount;

    // grab existing convenience & bank charges
    const convEl    = document.getElementById('fare-conv');
    const bankEl    = document.getElementById('fare-bank');
    const convFee   = parseFloat(convEl.textContent.replace(/,/g, '')) || 0;
    const bankCharge = parseFloat(bankEl.textContent.replace(/,/g, '')) || 0;

    // update the DOM
    document.getElementById('fare-bus').textContent =
      totalBusFare.toLocaleString('en-LK', { minimumFractionDigits: 2 });
    const grandTotal = totalBusFare + convFee + bankCharge;
    document.getElementById('fare-total').textContent =
      grandTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 });
  })();

});

/**
 * “Proceed To Pay” button logic:
 *   - Validate that all fields are non-empty and valid.
 *   - If OK: merge personal details into pendingBooking and redirect to payment.html
 */
const proceedBtn = document.getElementById("proceed-btn");
if (proceedBtn) {
  proceedBtn.addEventListener("click", (e) => {
    e.preventDefault();

    // Get form fields
    const nameInp = document.getElementById("name");
    const mobileInp = document.getElementById("mobile");
    const nicInp = document.getElementById("nic");
    const emailInp = document.getElementById("email");
    const agreeChk = document.getElementById("agree-terms");

    // Trimmed values
    const nameVal = nameInp.value.trim();
    const mobileVal = mobileInp.value.trim();
    const nicVal = nicInp.value.trim();
    const emailVal = emailInp.value.trim();
    const agreed = agreeChk.checked;

    // Simple validation
    if (!nameVal) {
      showPersonalModal("Please enter your Name.", nameInp);
      return;
    }
    if (!mobileVal) {
      showPersonalModal("Please enter your Mobile Number.", mobileInp);
      return;
    }
    const mobilePattern = /^[0-9\s\-()+]{7,20}$/;
    if (!mobilePattern.test(mobileVal)) {
      showPersonalModal("Please enter a valid Mobile Number.", mobileInp);
      return;
    }
    if (!nicVal) {
      showPersonalModal("Please enter your NIC or Passport Number.", nicInp);
      return;
    }
    if (!emailVal) {
      showPersonalModal("Please enter your Email address.", emailInp);
      return;
    }
    // Browser’s built-in email validity will catch format errors
    if (!agreed) {
      showPersonalModal("You must agree to the Terms & Conditions before proceeding.", agreeChk);
      return;
    }

    // Merge into pendingBooking
    const pendingStr = localStorage.getItem("pendingBooking");
    if (!pendingStr) {
      console.error("No pendingBooking to merge personal details.");
      window.location.href = "select_seat.html";
      return;
    }
    let pendingBooking;
    try {
      pendingBooking = JSON.parse(pendingStr);
    } catch (e) {
      console.error("Error parsing pendingBooking:", e);
      localStorage.removeItem("pendingBooking");
      window.location.href = "select_seat.html";
      return;
    }
    pendingBooking.personal = {
      name: nameVal,
      mobile: mobileVal,
      nic: nicVal,
      email: emailVal
    };
    localStorage.setItem("pendingBooking", JSON.stringify(pendingBooking));

    // Redirect to payment.html
    window.location.href = "payment.html";
  });
}

// Custom modal for personal details page (same style as select_seat)
const personalModalHtml = `
  <div id="personal-modal" class="modal-overlay" aria-hidden="true">
    <div class="modal-box" role="dialog" aria-modal="true">
      <p id="personal-modal-message" style="color:#102542; font-size:1rem; margin-bottom:16px;"></p>
      <button id="personal-modal-ok-btn" class="modal-ok-btn">OK</button>
    </div>
  </div>`;
document.body.insertAdjacentHTML('beforeend', personalModalHtml);

const personalModal = document.getElementById("personal-modal");
const personalModalMessage = document.getElementById("personal-modal-message");
const personalModalOkBtn = document.getElementById("personal-modal-ok-btn");
function showPersonalModal(msg, focusEl) {
  if (personalModalMessage) personalModalMessage.textContent = msg;
  if (personalModal) {
    personalModal.setAttribute("aria-hidden", "false");
  }
  if (focusEl) focusEl.focus();
}
function hidePersonalModal() {
  if (personalModal) {
    personalModal.setAttribute("aria-hidden", "true");
  }
}
if (personalModalOkBtn) {
  personalModalOkBtn.addEventListener("click", () => {
    hidePersonalModal();
  });
}
