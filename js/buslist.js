// js/buslist.js

// 1. Toggle navigation drawer open/lose
const menuBtn = document.getElementById("menu-btn");
const navDrawer = document.getElementById("nav-drawer");
if (menuBtn) {
  menuBtn.addEventListener("click", () => {
    navDrawer.classList.toggle("open");
  });
}
// Close drawer if clicking outside
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

// 2. “Go Back” button: always go to home page (home.html)
const backBtn = document.getElementById("back-btn");
if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.location.href = "home.html";
  });
}

// Utility: parse query parameters
function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

// Utility: format a Date object to "DD / Mon / YYYY"
function formatDateFull(d) {
  const dd = d.getDate().toString().padStart(2, '0');
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = monthNames[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd} / ${mon} / ${yyyy}`;
}
// Utility: format Date object to "DD Mon"
function formatDateShort(d) {
  const dd = d.getDate().toString().padStart(2, '0');
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = monthNames[d.getMonth()];
  return `${dd} ${mon}`;
}

// Example times arrays per box (static). In a real app, replace with data fetched per route.
const boxTimes = {
  box2: ["20:00","21:00","01:00","04:00"],
  box3: ["04:00","20:00","01:00"],
  box4: ["20:00","01:00"],
  box5: ["20:00","21:00","04:00"]
};
// Example availability prefix text
const boxAvailabilityText = {
  box2: "40 Seats available – Closing : ",
  box3: "09 Seats available – Closing : ",
  box4: "40 Seats available – Closing : ",
  box5: "00 Seats available"
};

// Master stops in forward direction. Extend this array if your real route has more stops.
const masterStopsForward = ["Jaffna", "Killinochchi", "Negombo", "Colombo"];

// 3. On DOMContentLoaded, read params and build UI
document.addEventListener("DOMContentLoaded", () => {
  const params = getQueryParams();
  let fromParam = params.get('from');
  let toParam = params.get('to');
  const dateParam = params.get('date'); // "YYYY-MM-DD"

  // Validate presence
  if (!fromParam || !toParam || !dateParam) {
    window.location.href = "home.html";
    return;
  }
  fromParam = fromParam.trim();
  toParam = toParam.trim();

  // Validate that fromParam and toParam exist in masterStopsForward (case-insensitive).
  const foundFrom = masterStopsForward.find(s => s.toLowerCase() === fromParam.toLowerCase());
  const foundTo   = masterStopsForward.find(s => s.toLowerCase() === toParam.toLowerCase());
  if (!foundFrom || !foundTo) {
    // Invalid stops → go back
    window.location.href = "home.html";
    return;
  }
  // Use canonical casing
  fromParam = foundFrom;
  toParam = foundTo;

  // Parse dateParam
  let baseDate = null;
  {
    const parts = dateParam.split('-');
    if (parts.length === 3) {
      const yyyy = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10) - 1;
      const dd = parseInt(parts[2], 10);
      baseDate = new Date(yyyy, mm, dd);
    }
  }
  if (!baseDate || isNaN(baseDate.getTime())) {
    window.location.href = "home.html";
    return;
  }

  // Update Box 1
  const box1Line1 = document.getElementById("box1-line1");
  const box1Line2 = document.getElementById("box1-line2");
  if (box1Line1) box1Line1.textContent = `${fromParam} > ${toParam}`;
  if (box1Line2) box1Line2.textContent = formatDateFull(baseDate);

  // Determine fullStops in correct direction:
  const idxFromF = masterStopsForward.findIndex(s => s === fromParam);
  const idxToF   = masterStopsForward.findIndex(s => s === toParam);
  let fullStops;
  if (idxFromF <= idxToF) {
    fullStops = masterStopsForward.slice();
  } else {
    fullStops = masterStopsForward.slice().reverse();
  }
  // Find indices in fullStops
  const fromIndex = fullStops.findIndex(s => s === fromParam);
  const toIndex   = fullStops.findIndex(s => s === toParam);
  if (fromIndex < 0 || toIndex < 0) {
    window.location.href = "home.html";
    return;
  }

  // Helper: render a box (#boxNum) given stopsArr, timesArr, availabilityPrefix
  function renderBox(boxNum, stopsArr, timesArr, availabilityPrefix) {
    const stopsRow = document.getElementById(`box${boxNum}-stops-row`);
    const timelineDiv = document.getElementById(`box${boxNum}-timeline`);
    const timesDiv = document.getElementById(`box${boxNum}-times`);
    const availEl = document.getElementById(`box${boxNum}-availability`);
    if (!stopsRow || !timelineDiv || !timesDiv) return;

    // 1. Render stops-row
    stopsRow.innerHTML = "";
    stopsArr.forEach((stopName) => {
      const span = document.createElement("span");
      span.classList.add("stop");
      span.textContent = stopName;
      stopsRow.appendChild(span);
    });

    // 2. Render timeline
    timelineDiv.innerHTML = "";
    // Full black line
    const lineFull = document.createElement("div");
    lineFull.classList.add("timeline-line");
    timelineDiv.appendChild(lineFull);

    // Determine which positions in stopsArr correspond to orange (between fromIndex..toIndex inclusive in fullStops)
    const stopsIndexesInFull = stopsArr.map(st => fullStops.findIndex(fs => fs === st));
    let firstOrangePos = null, lastOrangePos = null;
    stopsIndexesInFull.forEach((fIdx, pos) => {
      if (fIdx >= Math.min(fromIndex, toIndex) && fIdx <= Math.max(fromIndex, toIndex)) {
        if (firstOrangePos === null) firstOrangePos = pos;
        lastOrangePos = pos;
      }
    });
    // If we have an orange segment:
    if (firstOrangePos !== null && lastOrangePos !== null && stopsArr.length > 1) {
      const activeLine = document.createElement("div");
      activeLine.classList.add("timeline-active-line");
      const denom = stopsArr.length - 1;
      const leftPct = (firstOrangePos / denom) * 100;
      const widthPct = ((lastOrangePos - firstOrangePos) / denom) * 100;
      activeLine.style.left = `${leftPct}%`;
      activeLine.style.width = `${widthPct}%`;
      timelineDiv.appendChild(activeLine);
    }

    // 3. Render dots
    const dotsContainer = document.createElement("div");
    dotsContainer.classList.add("timeline-dots");
    stopsArr.forEach((stopName, pos) => {
      const dotContainer = document.createElement("div");
      dotContainer.classList.add("dot-container");
      // Place f.png above the From stop, t.png above the To stop:
      if (stopName === fromParam) {
        const imgFrom = document.createElement("img");
        imgFrom.src = `images/f.png`;
        imgFrom.alt = `From-icon`;
        imgFrom.classList.add("timeline-icon");
        dotContainer.appendChild(imgFrom);
      } else if (stopName === toParam) {
        const imgTo = document.createElement("img");
        imgTo.src = `images/t.png`;
        imgTo.alt = `To-icon`;
        imgTo.classList.add("timeline-icon");
        dotContainer.appendChild(imgTo);
      }
      // The dot itself:
      const dot = document.createElement("div");
      dot.classList.add("dot");
      // Color:
      const fIdx = fullStops.findIndex(fs => fs === stopName);
      if (fIdx >= Math.min(fromIndex, toIndex) && fIdx <= Math.max(fromIndex, toIndex)) {
        dot.style.background = "#ff6b00";
      } else {
        dot.style.background = "#102542";
      }
      dotContainer.appendChild(dot);
      dotsContainer.appendChild(dotContainer);
    });
    timelineDiv.appendChild(dotsContainer);

    // 4. Render times & dates
    timesDiv.innerHTML = "";
    const n = Math.min(timesArr.length, stopsArr.length);
    let prevHour = null;
    let currDate = new Date(baseDate.getTime());
    for (let i = 0; i < n; i++) {
      const timeText = timesArr[i];
      const [hhStr, mmStr] = timeText.split(':');
      const hh = parseInt(hhStr, 10);
      if (i === 0) {
        currDate = new Date(baseDate.getTime());
      } else {
        if (hh < prevHour) {
          currDate.setDate(currDate.getDate() + 1);
        }
      }
      prevHour = hh;
      const timeItem = document.createElement("div");
      timeItem.classList.add("time-item");
      // Create <span class="time">HH:MM</span><br><span class="date">DD Mon</span>
      const spanTime = document.createElement("span");
      spanTime.classList.add("time");
      spanTime.textContent = timeText;
      const br = document.createElement("br");
      const spanDate = document.createElement("span");
      spanDate.classList.add("date");
      spanDate.textContent = formatDateShort(currDate);
      timeItem.appendChild(spanTime);
      timeItem.appendChild(br);
      timeItem.appendChild(spanDate);
      timesDiv.appendChild(timeItem);
    }

    // 5. Availability text
    if (availEl && availabilityPrefix) {
      let availText = availabilityPrefix;
      if (availabilityPrefix.includes("Closing")) {
        availText += `${formatDateShort(baseDate)}, 18:00`;
      }
      availEl.textContent = availText;
    }
  }

  // 4. Build stops arrays for each box according to rules:
  const lastIdx = fullStops.length - 1;
  // Box 2: full route
  const stopsBox2 = fullStops.slice();
  // Box 4: direct From→To
  const stopsBox4 = [ fullStops[fromIndex], fullStops[toIndex] ];
  // Box 3: 3-stop variant
  let stopsBox3 = [];
  if (fromIndex === 0 && toIndex === lastIdx) {
    // entire route: first 3 stops
    stopsBox3 = fullStops.slice(0, Math.min(3, fullStops.length));
  } else if (fromIndex > 0 && toIndex === lastIdx) {
    stopsBox3 = [ fullStops[fromIndex - 1], fullStops[fromIndex], fullStops[lastIdx] ];
  } else if (fromIndex === 0 && toIndex < lastIdx) {
    stopsBox3 = [ fullStops[0], fullStops[1], fullStops[toIndex] ];
  } else if (fromIndex > 0 && toIndex < lastIdx) {
    stopsBox3 = [ fullStops[fromIndex - 1], fullStops[fromIndex], fullStops[toIndex] ];
  } else {
    stopsBox3 = fullStops.slice(0, Math.min(3, fullStops.length));
  }
  // Box 5: another 3-stop variant
  let stopsBox5 = [];
  if (fromIndex === 0 && toIndex === lastIdx) {
    stopsBox5 = fullStops.slice(Math.max(0, lastIdx - 2), lastIdx + 1);
  } else if (toIndex === lastIdx && fromIndex > 0) {
    stopsBox5 = [ fullStops[fromIndex - 1], fullStops[fromIndex], fullStops[lastIdx] ];
  } else if (fromIndex === 0 && toIndex < lastIdx) {
    stopsBox5 = [ fullStops[0], fullStops[toIndex - 1], fullStops[toIndex] ];
  } else if (fromIndex > 0 && toIndex < lastIdx) {
    stopsBox5 = [ fullStops[fromIndex - 1], fullStops[fromIndex], fullStops[toIndex] ];
  } else {
    stopsBox5 = fullStops.slice(Math.max(0, lastIdx - 2), lastIdx + 1);
  }

  // 5. Render each box:
  renderBox(2, stopsBox2, boxTimes.box2, boxAvailabilityText.box2);
  renderBox(3, stopsBox3, boxTimes.box3, boxAvailabilityText.box3);
  renderBox(4, stopsBox4, boxTimes.box4, boxAvailabilityText.box4);
  renderBox(5, stopsBox5, boxTimes.box5, boxAvailabilityText.box5);

  // 6. Attach BOOK SEAT handlers carrying query params forward
  const btn2 = document.getElementById("search-btn1");
  if (btn2) {
    btn2.addEventListener("click", () => {
      const p = getQueryParams();
      p.set('route', '02');
      window.location.href = 'select_seat.html?' + p.toString();
    });
  }
  const btn3 = document.getElementById("search-btn2");
  if (btn3) {
    btn3.addEventListener("click", () => {
      const p = getQueryParams();
      p.set('route', '20');
      window.location.href = 'select_seat.html?' + p.toString();
    });
  }
  const btn4 = document.getElementById("search-btn3");
  if (btn4) {
    btn4.addEventListener("click", () => {
      const p = getQueryParams();
      p.set('route', '222');
      window.location.href = 'select_seat.html?' + p.toString();
    });
  }
  // Box5 sold out: no action (or show message)
  const btn5 = document.getElementById("search-btn4");
  if (btn5) {
    btn5.addEventListener("click", (e) => {
      e.preventDefault();
      // Optionally show a message: alert("This route is sold out.");
    });
  }

  // 7. Bottom nav linking
  document.querySelectorAll(".nav-item-bottom").forEach(item => {
    item.addEventListener("click", () => {
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
});
