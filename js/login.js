// js/login.js
import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const emailEl  = document.getElementById('login-email');
const passEl   = document.getElementById('login-password');
const btn      = document.getElementById('login-btn');
const errorMsg = document.getElementById('error-msg');
const successModal = document.getElementById('login-success-modal');

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


btn.addEventListener('click', async () => {
  errorMsg.textContent = '';
  const email = emailEl.value.trim();
  const pw    = passEl.value;
  if (!email || !pw) {
    return errorMsg.textContent = 'Email & password are required.';
  }
  try {
    await signInWithEmailAndPassword(auth, email, pw);
    // Show success then auto‑redirect
    successModal.style.display = 'flex';
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 2000);
  } catch (err) {
    console.error(err);
    errorMsg.textContent = err.message.replace('Firebase: ','');
  }
});
