// js/register.js
import { auth, db } from './firebaseConfig.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const nameEl   = document.getElementById('reg-name');
const phoneEl  = document.getElementById('reg-phone');
const emailEl  = document.getElementById('reg-email');
const pwEl     = document.getElementById('reg-password');
const pw2El    = document.getElementById('reg-password2');
const btn      = document.getElementById('register-btn');

const errs = {
  name:     document.getElementById('err-name'),
  phone:    document.getElementById('err-phone'),
  email:    document.getElementById('err-email'),
  password: document.getElementById('err-password'),
  password2:document.getElementById('err-password2'),
};

// Sri Lankan phone regex
const phonePattern = /^(?:\+94|0)7\d{8}$/;

function clearErrors() {
  Object.values(errs).forEach(el => el.textContent = '');
}

function validate() {
  clearErrors();
  let ok = true;
  if (!nameEl.value.trim()) {
    errs.name.textContent = 'Name is required.'; ok = false;
  }
  const ph = phoneEl.value.trim();
  if (!ph) {
    errs.phone.textContent = 'Phone is required.'; ok = false;
  } else if (!phonePattern.test(ph)) {
    errs.phone.textContent = 'Invalid Sri Lankan phone.'; ok = false;
  }
  const em = emailEl.value.trim();
  if (!em) {
    errs.email.textContent = 'Email is required.'; ok = false;
  } else if (!/\S+@\S+\.\S+/.test(em)) {
    errs.email.textContent = 'Invalid email format.'; ok = false;
  }
  const pw = pwEl.value;
  if (pw.length < 6) {
    errs.password.textContent = 'At least 6 characters.'; ok = false;
  }
  if (pw2El.value !== pw) {
    errs.password2.textContent = 'Passwords do not match.'; ok = false;
  }
  return ok;
}

// Toggle password visibility
document.querySelectorAll('.toggle-eye1').forEach(icon => {
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


// Registration
btn.addEventListener('click', async () => {
  if (!validate()) return;

  btn.disabled = true;
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      emailEl.value.trim(),
      pwEl.value
    );
    const uid = cred.user.uid;
    // Store profile
    await setDoc(doc(db, 'users', uid), {
      name:  nameEl.value.trim(),
      phone: phoneEl.value.trim(),
      email: emailEl.value.trim(),
      createdAt: new Date()
    });
    // Show success modal
    document.getElementById('success-modal').style.display = 'flex';
  } catch (e) {
    const msg = e.message.replace('Firebase: ','');
    if (/email/.test(msg.toLowerCase())) {
      errs.email.textContent = msg;
    } else {
      alert(msg);
    }
    btn.disabled = false;
  }
});

// Back to login
document.getElementById('to-login-btn').addEventListener('click', () => {
  window.location.href = 'index.html';
});
