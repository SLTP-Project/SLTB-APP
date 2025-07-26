// js/account.js
import { auth, db } from './firebaseConfig.js';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const profilePhotoEl = document.getElementById('profile-photo');
const photoInputEl   = document.getElementById('photo-input');
const nameEl         = document.getElementById('info-name');
const emailEl        = document.getElementById('info-email');
const phoneEl        = document.getElementById('info-phone');
const passFieldEl    = document.getElementById('info-password');
const logoutBtn      = document.getElementById('logout-btn');
const logoutModal    = document.getElementById('logout-modal');
const confirmLogout  = document.getElementById('confirm-logout');
const cancelLogout   = document.getElementById('cancel-logout');
const toggleEyes     = document.querySelectorAll('.toggle-eye');

const storage = getStorage();

// 1) Auth state & load profile
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  const uid = user.uid;
  const udoc = doc(db, 'users', uid);
  const snap = await getDoc(udoc);
  if (snap.exists()) {
    const data = snap.data();
    nameEl.textContent  = data.name || '';
    emailEl.textContent = data.email || '';
    phoneEl.textContent = data.phone || '';
    if (data.photoURL) profilePhotoEl.src = data.photoURL;
  }
  if (user.photoURL) profilePhotoEl.src = user.photoURL;

  // for demo only: show placeholder password
  passFieldEl.value = '••••••••';
});

// 2) Change Photo
photoInputEl.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  // preview
  const reader = new FileReader();
  reader.onload = () => profilePhotoEl.src = reader.result;
  reader.readAsDataURL(file);

  // upload
  const user = auth.currentUser;
  const imgRef = storageRef(storage, `profiles/${user.uid}/${file.name}`);
  await uploadBytes(imgRef, file);
  const url = await getDownloadURL(imgRef);

  // update auth & firestore
  await updateProfile(user, { photoURL: url });
  await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
});

// 3) Toggle password view
toggleEyes.forEach(icon => {
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


// 4) Logout modal
logoutBtn.addEventListener('click', () => {
  logoutModal.style.display = 'flex';
});
cancelLogout.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});
confirmLogout.addEventListener('click', () => {
  logoutModal.style.display = 'none';
});

// 5) Drawer toggle
const menuBtn = document.getElementById("menu-btn");
const navDrawer = document.getElementById("nav-drawer");
if (menuBtn) {
  menuBtn.addEventListener("click", () => navDrawer.classList.toggle("open"));
}
document.addEventListener("click", e => {
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
