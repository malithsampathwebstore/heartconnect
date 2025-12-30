import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, where, serverTimestamp, setDoc, updateDoc, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ------------------------------------------------------------------
// FIREBASE CONFIG
// ------------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyCSX6OsrY_q2mfgDWBe7doqA95OHOUlTcw",
    authDomain: "relationnship-aac55.firebaseapp.com",
    projectId: "relationnship-aac55",
    storageBucket: "relationnship-aac55.firebasestorage.app",
    messagingSenderId: "249072987192",
    appId: "1:249072987192:web:6dda115c3e4fd6e9988acd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Global State
let profiles = [];
let currentModalProfile = null;
let currentUser = null;
let currentChatPartner = null;
let messageUnsubscribe = null;

const grid = document.getElementById('profilesGrid');
const countBadge = document.getElementById('profileCount');
const loggedInElements = document.querySelectorAll('.logged-in-only');
const loggedOutElements = document.querySelectorAll('.logged-out-only');

// --- 1. Auth Listener ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loggedInElements.forEach(el => el.style.display = 'block');
        loggedOutElements.forEach(el => el.style.display = 'none');
        
        const myProfile = profiles.find(p => p.id === user.uid);
        if(myProfile) {
            document.getElementById('navUserName').textContent = `Hi, ${myProfile.name}`;
            document.getElementById('userMatchAvatar').src = myProfile.image || "https://via.placeholder.com/100";
        }
        showToast("Logged in successfully");
    } else {
        loggedInElements.forEach(el => el.style.display = 'none');
        loggedOutElements.forEach(el => el.style.display = 'block');
        document.getElementById('userMatchAvatar').src = "https://via.placeholder.com/100";
        document.getElementById('chatBox').style.display = 'none';
    }
    renderProfiles(profiles); 
});

// --- 2. Live Profile Feed ---
function initProfileListener() {
    const q = query(collection(db, "profiles"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        profiles = [];
        snapshot.forEach((doc) => {
            profiles.push({ id: doc.id, ...doc.data() });
        });

        if (profiles.length === 0) {
            grid.innerHTML = `<div class="col-12 text-center py-5"><h3>No profiles yet</h3></div>`;
            countBadge.textContent = "0";
        } else {
            renderProfiles(profiles);
        }
    });
}

// --- 3. Render Grid ---
function renderProfiles(data) {
    grid.innerHTML = '';
    
    let displayData = data;
    if (currentUser) {
        displayData = data.filter(p => p.id !== currentUser.uid);
    }

    countBadge.textContent = displayData.length;

    displayData.forEach(profile => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        const imgUrl = profile.image || 'https://via.placeholder.com/500x500?text=No+Image';

        col.innerHTML = `
            <div class="profile-card h-100">
                <div class="card-img-wrapper" data-id="${profile.id}" style="cursor: pointer;">
                    <img src="${imgUrl}" class="card-img-top" alt="${profile.name}">
                    <div class="online-badge">
                        <i class="bi bi-circle-fill text-white me-1" style="font-size: 8px;"></i> Online
                    </div>
                    <div class="position-absolute bottom-0 start-0 w-100 p-3 bg-gradient-to-t" style="background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);">
                        <h4 class="text-white mb-0 fw-bold">${profile.name}, ${profile.age}</h4>
                        <small class="text-white-50"><i class="bi bi-geo-alt-fill me-1"></i>${profile.location}</small>
                    </div>
                </div>
                <div class="card-body">
                    <p class="card-text text-muted small mb-3 text-truncate">${profile.bio}</p>
                    <div class="action-btn-group">
                        <button class="btn btn-outline-secondary info-btn" data-id="${profile.id}"><i class="bi bi-info-circle"></i></button>
                        <button class="btn btn-connect connect-btn" data-id="${profile.id}">Connect <i class="bi bi-heart-fill ms-1"></i></button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });

    document.querySelectorAll('.card-img-wrapper, .info-btn').forEach(el => {
        el.addEventListener('click', (e) => openProfileModal(e.currentTarget.dataset.id));
    });

    document.querySelectorAll('.connect-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            if(!currentUser) {
                new bootstrap.Modal(document.getElementById('loginModal')).show();
                showToast("Please login to connect");
                return;
            }
            triggerMatch(e.currentTarget.dataset.id);
        });
    });
}

// --- 4. NEW: MY PROFILE / EDIT / DELETE ---

window.openMyProfile = async function() {
    if(!currentUser) return;
    
    // Fetch latest data for current user
    const docRef = doc(db, "profiles", currentUser.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Populate Form
        document.getElementById('editName').value = data.name;
        document.getElementById('editAge').value = data.age;
        document.getElementById('editGender').value = data.gender;
        document.getElementById('editLocation').value = data.location;
        document.getElementById('editImage').value = data.image;
        document.getElementById('editBio').value = data.bio;
        document.getElementById('editInterests').value = (data.interests || []).join(', ');

        new bootstrap.Modal(document.getElementById('myProfileModal')).show();
    } else {
        showToast("Error loading profile");
    }
}

document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveProfileBtn');
    btn.disabled = true; btn.innerText = "Saving...";

    try {
        const interestsStr = document.getElementById('editInterests').value;
        const updatedData = {
            name: document.getElementById('editName').value,
            age: parseInt(document.getElementById('editAge').value),
            gender: document.getElementById('editGender').value,
            location: document.getElementById('editLocation').value,
            image: document.getElementById('editImage').value,
            bio: document.getElementById('editBio').value,
            interests: interestsStr.split(',').map(s => s.trim())
        };

        await updateDoc(doc(db, "profiles", currentUser.uid), updatedData);
        
        bootstrap.Modal.getInstance(document.getElementById('myProfileModal')).hide();
        showToast("Profile updated successfully!");
        
        // Refresh nav name if changed
        document.getElementById('navUserName').textContent = `Hi, ${updatedData.name}`;

    } catch (error) {
        console.error(error);
        alert("Error updating profile.");
    } finally {
        btn.disabled = false; btn.innerText = "Save Changes";
    }
});

window.deleteAccount = async function() {
    if(!confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
    
    const uid = currentUser.uid;
    
    try {
        // 1. Delete Firestore Profile
        await deleteDoc(doc(db, "profiles", uid));
        
        // 2. Delete Auth User
        await deleteUser(currentUser);
        
        bootstrap.Modal.getInstance(document.getElementById('myProfileModal')).hide();
        alert("Account deleted.");
        
    } catch (error) {
        console.error(error);
        if(error.code === 'auth/requires-recent-login') {
            alert("For security, please log out and log back in before deleting your account.");
        } else {
            alert("Error deleting account: " + error.message);
        }
    }
}

// --- 5. INBOX & CHAT ---

function getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
}

window.openInbox = async function() {
    if(!currentUser) return;
    const inboxModal = new bootstrap.Modal(document.getElementById('inboxModal'));
    inboxModal.show();
    
    const list = document.getElementById('inboxList');
    list.innerHTML = '<div class="text-center p-3"><span class="spinner-border text-primary"></span></div>';

    try {
        const sentQ = query(collection(db, "messages"), where("senderId", "==", currentUser.uid));
        const receivedQ = query(collection(db, "messages"), where("receiverId", "==", currentUser.uid));

        const [sentSnap, receivedSnap] = await Promise.all([getDocs(sentQ), getDocs(receivedQ)]);

        const chatPartners = new Set();
        sentSnap.forEach(doc => chatPartners.add(doc.data().receiverId));
        receivedSnap.forEach(doc => chatPartners.add(doc.data().senderId));

        list.innerHTML = '';
        if(chatPartners.size === 0) {
            list.innerHTML = '<div class="text-center p-4 text-muted">No messages yet.</div>';
            return;
        }

        chatPartners.forEach(partnerId => {
            const partner = profiles.find(p => p.id === partnerId);
            if(partner) {
                const imgUrl = partner.image || 'https://via.placeholder.com/50?text=U';
                const item = document.createElement('div');
                item.className = 'inbox-item';
                item.onclick = () => {
                    inboxModal.hide();
                    openChat(partnerId);
                };
                item.innerHTML = `
                    <img src="${imgUrl}" class="inbox-avatar" alt="${partner.name}">
                    <div class="inbox-info"><h6>${partner.name}</h6><p>Click to chat</p></div>
                `;
                list.appendChild(item);
            }
        });

    } catch (error) {
        console.error("Inbox Error", error);
        list.innerHTML = '<div class="text-center p-3 text-danger">Error loading inbox.</div>';
    }
}

window.openChat = function(partnerId) {
    currentChatPartner = profiles.find(p => p.id === partnerId);
    if(!currentChatPartner) return;

    const matchModal = bootstrap.Modal.getInstance(document.getElementById('matchModal'));
    if(matchModal) matchModal.hide();

    document.getElementById('chatHeaderName').textContent = currentChatPartner.name;
    const chatBox = document.getElementById('chatBox');
    chatBox.style.display = 'flex';

    const chatId = getChatId(currentUser.uid, partnerId);
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, where("chatId", "==", chatId));

    if(messageUnsubscribe) messageUnsubscribe();

    const chatContainer = document.getElementById('chatMessages');
    
    messageUnsubscribe = onSnapshot(q, (snapshot) => {
        chatContainer.innerHTML = '';
        let msgs = [];
        snapshot.forEach(doc => msgs.push(doc.data()));

        msgs.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeA - timeB;
        });

        if(msgs.length === 0) {
            chatContainer.innerHTML = '<div class="text-center text-muted small mt-5">No messages yet. Say hi!</div>';
        }

        msgs.forEach(msg => {
            const div = document.createElement('div');
            const isMe = msg.senderId === currentUser.uid;
            div.className = `message-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;
            div.textContent = msg.text;
            chatContainer.appendChild(div);
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

window.closeChat = function() {
    document.getElementById('chatBox').style.display = 'none';
    if(messageUnsubscribe) messageUnsubscribe();
    currentChatPartner = null;
}

document.getElementById('chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser || !currentChatPartner) return;
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if(!text) return;
    const chatId = getChatId(currentUser.uid, currentChatPartner.id);
    try {
        await addDoc(collection(db, "messages"), {
            text: text,
            senderId: currentUser.uid,
            receiverId: currentChatPartner.id,
            chatId: chatId,
            createdAt: serverTimestamp()
        });
        input.value = ''; 
    } catch (error) { console.error(error); showToast("Failed to send"); }
});

window.triggerMatch = function(id) {
    const profile = profiles.find(p => p.id === id);
    if(!profile) return;
    document.getElementById('matchName').textContent = profile.name;
    document.getElementById('matchImage').src = profile.image;
    
    const startChatBtn = document.getElementById('startChatBtn');
    const newBtn = startChatBtn.cloneNode(true);
    startChatBtn.parentNode.replaceChild(newBtn, startChatBtn);
    newBtn.addEventListener('click', () => openChat(id));

    const detailModal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
    if(detailModal) detailModal.hide();
    new bootstrap.Modal(document.getElementById('matchModal')).show();
}

// --- 6. Registration & Login ---
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitRegBtn');
    btn.disabled = true; btn.innerHTML = 'Creating...';
    try {
        const userCred = await createUserWithEmailAndPassword(auth, document.getElementById('regEmail').value, document.getElementById('regPassword').value);
        const interestsStr = document.getElementById('regInterests').value;
        const newProfile = {
            name: document.getElementById('regName').value,
            age: parseInt(document.getElementById('regAge').value),
            gender: document.getElementById('regGender').value,
            location: document.getElementById('regLocation').value,
            image: document.getElementById('regImage').value,
            bio: document.getElementById('regBio').value,
            interests: interestsStr.split(',').map(s => s.trim()),
            createdAt: serverTimestamp(),
            uid: userCred.user.uid
        };
        await setDoc(doc(db, "profiles", userCred.user.uid), newProfile);
        bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
        document.getElementById('registerForm').reset();
        showToast("Account created!");
    } catch (error) { alert(error.message); } 
    finally { btn.disabled = false; btn.textContent = 'Create Profile'; }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        document.getElementById('loginForm').reset();
    } catch (error) { alert("Login Failed: " + error.message); }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await signOut(auth);
    showToast("Logged out");
});

// UI Helpers
window.openProfileModal = function(id) {
    currentModalProfile = profiles.find(p => p.id === id);
    if(!currentModalProfile) return;
    document.getElementById('detailImage').src = currentModalProfile.image || '';
    document.getElementById('detailName').textContent = currentModalProfile.name;
    document.getElementById('detailAge').textContent = currentModalProfile.age;
    document.getElementById('detailLocation').textContent = currentModalProfile.location;
    document.getElementById('detailBio').textContent = currentModalProfile.bio;
    const tags = document.getElementById('detailInterests');
    tags.innerHTML = (currentModalProfile.interests || []).map(i => `<span class="badge bg-light text-dark border me-1 p-2">${i}</span>`).join('');
    new bootstrap.Modal(document.getElementById('profileModal')).show();
}

document.getElementById('detailConnectBtn').addEventListener('click', () => {
     if(currentModalProfile) {
         if(!currentUser) {
            bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
            new bootstrap.Modal(document.getElementById('loginModal')).show();
            return;
         }
         triggerMatch(currentModalProfile.id);
     }
});

document.getElementById('applyFiltersBtn').addEventListener('click', () => {
    const gender = document.getElementById('genderFilter').value;
    const maxAge = parseInt(document.getElementById('ageRange').value);
    const filtered = profiles.filter(p => {
        return (gender === 'all' || p.gender === gender) && p.age <= maxAge;
    });
    renderProfiles(filtered);
    showToast(`Filters applied.`);
});

document.getElementById('resetFiltersBtn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('genderFilter').value = 'all';
    document.getElementById('ageRange').value = 35;
    document.getElementById('ageVal').textContent = "35";
    renderProfiles(profiles);
});

document.getElementById('ageRange').addEventListener('input', (e) => document.getElementById('ageVal').textContent = e.target.value);
function showToast(msg) {
    document.getElementById('toastMessage').textContent = msg;
    new bootstrap.Toast(document.getElementById('liveToast')).show();
}
document.getElementById('seedDataBtn').addEventListener('click', async function() {
    if(!confirm("Add demo profiles?")) return;
    const demoData = [
        { name: "Sarah", age: 26, location: "New York", gender: "female", bio: "Loves coffee & code.", interests: ["Tech", "Coffee"], image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500", createdAt: serverTimestamp() },
        { name: "James", age: 29, location: "London", gender: "male", bio: "Chef & Traveler.", interests: ["Food", "Travel"], image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500", createdAt: serverTimestamp() }
    ];
    try {
        for (const p of demoData) { await addDoc(collection(db, "profiles"), p); }
        showToast("Demo profiles added!");
    } catch(e) { alert("Error adding demo data."); }
});

initProfileListener();