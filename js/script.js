//script.js
// Toggle navigation drawer open/close
const menuBtn = document.getElementById("menu-btn");
const navDrawer = document.getElementById("nav-drawer");

menuBtn.addEventListener("click", () => {
  navDrawer.classList.toggle("open");
});

// Close drawer when clicking outside the drawer
document.addEventListener("click", (e) => {
  if (
    !navDrawer.contains(e.target) &&
    !menuBtn.contains(e.target) &&
    navDrawer.classList.contains("open")
  ) {
    navDrawer.classList.remove("open");
  }
});

// Utility arrays for date parsing
const weekdays = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Elements
const dateInput = document.getElementById("travel-date");
const dateDayEl = document.querySelector(".date-day");
const dateWeekdayEl = document.querySelector(".date-weekday");
const dateMonthEl = document.querySelector(".date-month");

const fromInput = document.getElementById("from");
const toInput = document.getElementById("to");

const searchBtn = document.getElementById("search-btn");

// Modal
const customModal = document.getElementById("custom-modal");
const modalOkBtn = document.getElementById("modal-ok-btn");
const modalMessageEl = document.getElementById("modal-message");

// Valid locations (must match datalist entries). Update this list if you add more options.
const validLocations = ["Colombo", "Negombo", "Killinochchi", "Jaffna"];

// Show modal with message
function showModal(message) {
  modalMessageEl.textContent = message;
  customModal.style.display = "flex";
  customModal.setAttribute("aria-hidden", "false");
}

// Hide modal
function hideModal() {
  customModal.style.display = "none";
  customModal.setAttribute("aria-hidden", "true");
}

// Close the modal when OK is clicked
modalOkBtn.addEventListener("click", () => {
  hideModal();
});

// Initialize date input: set min to today, default value = today
function initDateInput() {
  const today = new Date();
  const yyyy = today.getFullYear();
  let mm = today.getMonth() + 1;
  let dd = today.getDate();
  if (mm < 10) mm = '0' + mm;
  if (dd < 10) dd = '0' + dd;
  const todayStr = `${yyyy}-${mm}-${dd}`;
  dateInput.setAttribute('min', todayStr);
  // If no value set, default to today
  if (!dateInput.value) {
    dateInput.value = todayStr;
  }
  updateDateDisplay(dateInput.value);
}

// Update the custom date display whenever the input changes
function updateDateDisplay(dateString) {
  if (!dateString) return;
  // parse as local date
  const dt = new Date(dateString + 'T00:00');
  const day = dt.getDate();
  const weekday = weekdays[dt.getDay()];
  const monthName = months[dt.getMonth()];
  const year = dt.getFullYear();

  dateDayEl.textContent = day;
  dateWeekdayEl.textContent = weekday;
  dateMonthEl.textContent = `${monthName} ${year}`;
}

// When the user picks a new date
dateInput.addEventListener("change", (e) => {
  const selected = e.target.value;
  if (selected < dateInput.min) {
    dateInput.value = dateInput.min;
  }
  updateDateDisplay(dateInput.value);
});

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  initDateInput();
});

// Helper to check if a value matches one of validLocations (case-insensitive)
function isValidLocation(value) {
  if (!value) return false;
  return validLocations.some(loc => loc.toLowerCase() === value.trim().toLowerCase());
}

// FROM/TO logic: prevent same selection and invalid entries
function validateFromToInputs() {
  const fromVal = fromInput.value.trim();
  const toVal = toInput.value.trim();

  // If user typed something non-empty, check validity against list:
  if (fromVal && !isValidLocation(fromVal)) {
    showModal(`'From' location "${fromVal}" not recognized. Please choose a valid location.`);
    fromInput.value = "";
    return false;
  }
  if (toVal && !isValidLocation(toVal)) {
    showModal(`'To' location "${toVal}" not recognized. Please choose a valid location.`);
    toInput.value = "";
    return false;
  }
  // If both present and same (case-insensitive)
  if (fromVal && toVal && fromVal.toLowerCase() === toVal.toLowerCase()) {
    showModal("‘From’ and ‘To’ cannot be the same location.");
    // Clear one (here we clear To to force re-entry)
    toInput.value = "";
    return false;
  }
  return true;
}

// Add change listeners to validate as soon as user leaves the field
fromInput.addEventListener("change", () => {
  validateFromToInputs();
});
toInput.addEventListener("change", () => {
  validateFromToInputs();
});

// Search buses button (validation + redirect with params)
searchBtn.addEventListener("click", () => {
  const fromVal = fromInput.value.trim();
  const toVal = toInput.value.trim();
  const dateVal = dateInput.value;

  // Basic presence check
  if (!fromVal || !toVal || !dateVal) {
    showModal("Please select From, To, and a travel date.");
    return;
  }
  // Validate that typed values exist in validLocations
  if (!isValidLocation(fromVal)) {
    showModal(`'From' location "${fromVal}" not recognized. Please choose a valid location.`);
    fromInput.value = "";
    return;
  }
  if (!isValidLocation(toVal)) {
    showModal(`'To' location "${toVal}" not recognized. Please choose a valid location.`);
    toInput.value = "";
    return;
  }
  // Prevent same
  if (fromVal.toLowerCase() === toVal.toLowerCase()) {
    showModal("‘From’ and ‘To’ cannot be the same location.");
    toInput.value = "";
    return;
  }
  // Date validity
  if (dateVal < dateInput.min) {
    showModal("Please select a valid travel date (today or future).");
    dateInput.value = dateInput.min;
    updateDateDisplay(dateInput.value);
    return;
  }
  // Build URL with query parameters
  const searchUrl = `buslist.html?from=${encodeURIComponent(fromVal)}&to=${encodeURIComponent(toVal)}&date=${encodeURIComponent(dateVal)}`;
  window.location.href = searchUrl;
});

// Bottom nav highlighting & navigation
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
