/**
 * payment.js
 * Handles Payment page logic with custom modal dialogs for validation messages,
 * and merges paymentMethod into pendingBooking, but does NOT write to Firestore yet.
 */

/** Toggle navigation drawer open/close */
const menuBtn = document.getElementById("menu-btn");
const navDrawer = document.getElementById("nav-drawer");
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

/** “Go Back” button: returns to personal_details.html via history.back() */
const backBtn = document.getElementById("back-btn");
if (backBtn) {
  backBtn.addEventListener("click", () => {
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

/** Custom modal dialog for messages */
const paymentModal = document.getElementById("payment-modal");
const paymentModalMessage = document.getElementById("payment-modal-message");
const paymentModalOkBtn = document.getElementById("payment-modal-ok-btn");
function showModal(message) {
  if (paymentModalMessage) paymentModalMessage.textContent = message;
  if (paymentModal) {
    paymentModal.setAttribute("aria-hidden", "false");
  }
}
function hideModal() {
  if (paymentModal) {
    paymentModal.setAttribute("aria-hidden", "true");
  }
}
if (paymentModalOkBtn) {
  paymentModalOkBtn.addEventListener("click", () => {
    hideModal();
  });
}

/** Cancel button: go to payment_failed.html */
const cancelBtn = document.getElementById("cancel-btn");
if (cancelBtn) {
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "payment_failed.html";
  });
}

/** Pay button: validate fields, merge paymentMethod into pendingBooking, then go to payment_successful.html */
const payBtn = document.getElementById("pay-btn");
if (payBtn) {
  payBtn.addEventListener("click", (e) => {
    e.preventDefault();

    // Grab all input fields:
    const cardTypeInput = document.querySelector('input[name="card-type"]:checked');
    const cardNumberInput = document.getElementById("card-number");
    const expMonthInput = document.getElementById("exp-month");
    const expYearInput = document.getElementById("exp-year");
    const cvvInput = document.getElementById("cvv");

    // Get values trimmed
    const cardType = cardTypeInput ? cardTypeInput.value : null;
    const cardNumberRaw = cardNumberInput ? cardNumberInput.value.trim() : "";
    const expMonthRaw = expMonthInput ? expMonthInput.value.trim() : "";
    const expYearRaw = expYearInput ? expYearInput.value.trim() : "";
    const cvvRaw = cvvInput ? cvvInput.value.trim() : "";

    // Validation

    // Card type
    if (!cardType) {
      showModal("Please select a card type.");
      return;
    }

    // Card number: remove spaces, check exactly 16 digits
    const digitsOnly = cardNumberRaw.replace(/\s+/g, "");
    if (!digitsOnly) {
      showModal("Please enter your card number.");
      cardNumberInput && cardNumberInput.focus();
      return;
    }
    if (!/^\d{16}$/.test(digitsOnly)) {
      showModal("Please enter a valid card number (exactly 16 digits).");
      cardNumberInput && cardNumberInput.focus();
      return;
    }

    // Expiration month: must be two digits 01-12
    if (!expMonthRaw) {
      showModal("Please enter expiration month.");
      expMonthInput && expMonthInput.focus();
      return;
    }
    if (!/^\d{1,2}$/.test(expMonthRaw)) {
      showModal("Expiration month must be numeric between 01 and 12.");
      expMonthInput && expMonthInput.focus();
      return;
    }
    let expMonthNum = parseInt(expMonthRaw, 10);
    if (expMonthNum < 1 || expMonthNum > 12) {
      showModal("Expiration month must be between 01 and 12.");
      expMonthInput && expMonthInput.focus();
      return;
    }

    // Expiration year: two digits, >= current year % 100
    if (!expYearRaw) {
      showModal("Please enter expiration year.");
      expYearInput && expYearInput.focus();
      return;
    }
    if (!/^\d{2}$/.test(expYearRaw)) {
      showModal("Expiration year must be two digits (e.g. 25 for 2025).");
      expYearInput && expYearInput.focus();
      return;
    }
    const expYearNum = parseInt(expYearRaw, 10);
    const now = new Date();
    const currentYearFull = now.getFullYear(); // e.g. 2025
    const currentYearTwo = currentYearFull % 100; // e.g. 25
    if (expYearNum < currentYearTwo) {
      showModal("Card expired. Please use a valid expiration year.");
      expYearInput && expYearInput.focus();
      return;
    }
    if (expYearNum === currentYearTwo) {
      const currentMonth = now.getMonth() + 1; // 1-12
      if (expMonthNum < currentMonth) {
        showModal("Card expired. Please use a valid expiration date.");
        expMonthInput && expMonthInput.focus();
        return;
      }
    }

    // CVV
    if (!cvvRaw) {
      showModal("Please enter CVV.");
      cvvInput && cvvInput.focus();
      return;
    }
    if (!/^\d{3,4}$/.test(cvvRaw)) {
      showModal("CVV must be 3 or 4 digits.");
      cvvInput && cvvInput.focus();
      return;
    }

    // All validations passed:
    // Merge paymentMethod into pendingBooking in localStorage
    const pendingStr = localStorage.getItem("pendingBooking");
    if (!pendingStr) {
      console.error("No pendingBooking to merge payment method.");
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
    pendingBooking.paymentMethod = cardType; // "visa" or "mastercard"
    // Optionally store last4 digits
    pendingBooking.cardLast4 = digitsOnly.slice(-4);
    localStorage.setItem("pendingBooking", JSON.stringify(pendingBooking));

    // Redirect to payment_successful.html
    window.location.href = "payment_successful.html";
  });
}
