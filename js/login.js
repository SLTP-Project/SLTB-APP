import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const emailEl      = document.getElementById('login-email');
const passEl       = document.getElementById('login-password');
const btn          = document.getElementById('login-btn');

// Success modal (already in your page)
const successModal = document.getElementById('login-success-modal');

// Error modal elements
const errorModal   = document.getElementById('login-error-modal');
const errorMsgEl   = document.getElementById('login-error-message');
const errorOkBtn   = document.getElementById('login-error-ok');

// Toggle password visibility
document.querySelectorAll('.toggle-eye').forEach(icon => {
  icon.addEventListener('click', () => {
    const tgt = document.getElementById(icon.dataset.target);
    if (!tgt) return;
    if (tgt.type === 'password') {
      tgt.type = 'text';
      icon.textContent = 'visibility_off';
    } else {
      tgt.type = 'password';
      icon.textContent = 'visibility';
    }
  });
});

// Show error modal
function showError(message) {
  errorMsgEl.textContent = message;
  errorModal.style.display = 'flex';
  errorModal.setAttribute('aria-hidden', 'false');
}

// Hide error modal
errorOkBtn.addEventListener('click', () => {
  errorModal.style.display = 'none';
  errorModal.setAttribute('aria-hidden', 'true');
});

btn.addEventListener('click', async () => {
  const email = emailEl.value.trim();
  const pw    = passEl.value;

  if (!email || !pw) {
    return showError('Email & password are required.');
  }

  try {
    await signInWithEmailAndPassword(auth, email, pw);
    // // Show success then auto‑redirect
    // successModal.style.display = 'flex';
    // setTimeout(() => {
    //   window.location.href = 'home.html';
    // }, 1000);
    window.location.href = 'home.html';
  } catch (err) {
  console.error('Firebase auth failed:', err);

  // Grab the code (might be undefined)
  const code = err.code || '';
  const msg  = err.message || '';

  let friendly;
  switch (code) {
    case 'auth/invalid-email':
      friendly = 'Please enter a valid email address.';
      break;
    case 'auth/user-not-found':
      friendly = 'No account found with that email.';
      break;
    case 'auth/wrong-password':
      friendly = 'Incorrect password. Please try again.';
      break;
    case 'auth/invalid-credential':
      // sometimes Firebase surfaces this instead of wrong-password
      friendly = 'Incorrect password. Please try again.';
      break;
    case 'auth/user-disabled':
      friendly = 'This account has been disabled. Contact support.';
      break;

    default:
      // fallback: inspect the message text
      if (msg.includes('wrong-password')) {
        friendly = 'Incorrect password. Please try again.';
      } else if (msg.includes('invalid-email')) {
        friendly = 'Please enter a valid email address.';
      } else if (msg.includes('user-not-found')) {
        friendly = 'No account found with that email.';
      } else {
        // ultimate fallback
        friendly = msg.replace('Firebase: ', '');
      }
  }

  showError(friendly);
}

});
