/**
 * Toggle navigation drawer open/close
 */
const menuBtn = document.getElementById("menu-btn");
const navDrawer = document.getElementById("nav-drawer");

menuBtn.addEventListener("click", () => {
  navDrawer.classList.toggle("open");
});

// Close drawer if clicking outside
document.addEventListener("click", (e) => {
  if (
    !navDrawer.contains(e.target) &&
    !menuBtn.contains(e.target) &&
    navDrawer.classList.contains("open")
  ) {
    navDrawer.classList.remove("open");
  }
});

/**
 * “Go Back” button: returns to payment.html
 */
document.getElementById("back-btn").addEventListener("click", () => {
  window.location.href = "payment.html";
});

/**
 * “Retry Payment” button: go back to payment.html
 */
document.getElementById("retry-btn").addEventListener("click", () => {
  window.location.href = "payment.html";
});

/**
 * “Cancel” button: go back to personal_details.html (or wherever you want)
 */
document.getElementById("cancel-btn").addEventListener("click", () => {
  window.location.href = "personal_details.html";
});

/**
 * Highlight bottom nav items when clicked (optional)
 */
document.querySelectorAll(".nav-item-bottom").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item-bottom").forEach((el) =>
      el.classList.remove("active")
    );
    item.classList.add("active");
  });
});

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
