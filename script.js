/* ============================================
   101 OKEY PRO — MULTIPLAYER LOBBY SYSTEM
   Firebase Realtime Database | Gamified UI
   ============================================ */

const firebaseConfig = { 
    databaseURL: "https://okey-ef015-default-rtdb.europe-west1.firebasedatabase.app/" 
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ============================================
   UTILITIES
   ============================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function generateId() {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(2, 6);
}

function generateFunName() {
    const adjectives = ['Şanslı','Hızlı','Zeki','Cesur','Sihirli','Altın','Gümüş','Demir','Kral','Prens','Sultan','Efsane','Süper','Mega','Ultra'];
    const nouns = ['Aslan','Kartal','Kaplan','Kurt','Ayı','Ejderha','Şahin','Kobra','Leopar','Panter','Fırtına','Yıldırım','Ateş','Buz','Gölge'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return adj + noun + num;
}

function getUserName() {
    let name = localStorage.getItem('okey_user_name');
    if (!name) {
        name = generateFunName();
        localStorage.setItem('okey_user_name', name);
    }
    return name;
}

function setUserName(name) {
    if (name && name.trim()) {
        localStorage.setItem('okey_user_name', name.trim());
        return true;
    }
    return false;
}

function showToast(message, type = 'info') {
    const container = $('#toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast('Kopyalandı!', 'success'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Kopyalandı!', 'success');
    }
}

/* ============================================
   DEVICE & IP
   ============================================ */
let clientIP = "Yükleniyor...";
let deviceType = (/Android/i.test(navigator.userAgent)) ? "📱 Android" : 
                 (/iPhone|iPad|iPod/i.test(navigator.userAgent)) ? "📱 iOS" : 
                 (/Windows/i.test(navigator.userAgent)) ? "💻 Windows" : 
                 (/Mac/i.test(navigator.userAgent)) ? "💻 MacOS" : "🖥️ Cihaz";

fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => { clientIP = d.ip; })
    .catch(() => { clientIP = "Bulunamadı"; });

/* ============================================
   STATE
   ============================================ */
let currentUser = getUserName();
let currentRoomId = null;
let roomRef = null;
let presenceRef = null;
let roomPresenceRef = null;
let activeUsersGlobal = 0;
let activeUsersRoom = 0;
let isDataLoaded = false;
let timerInterval = null;
let editTargetIndex = null;
let editTargetType = null;
let pendingJoinRoomId = null;

let uiState = { showScoreboard: false, showCalc: false, showAdisyon: false, calcValue: "" };

function getInitialRound() {
    return {
        p0: { double: false, score: "" }, p1: { double: false, score: "" },
        p2: { double: false, score: "" }, p3: { double: false, score: "" },
        winner: "-1", winType: "normal"
    };
}

function getInitialAdisyon() {
    return {
        items: [
            { id: 'cay', name: 'Çay', icon: '🍵', price: 15, qty: 0 },
            { id: 'su', name: 'Su', icon: '💧', price: 10, qty: 0 },
            { id: 'tost', name: 'Tost', icon: '🥪', price: 45, qty: 0 },
            { id: 'kahve', name: 'Kahve', icon: '☕', price: 35, qty: 0 },
            { id: 'soda', name: 'Soda', icon: '🥤', price: 12, qty: 0 },
            { id: 'cips', name: 'Cips', icon: '🥔', price: 25, qty: 0 },
        ],
        customTotal: 0
    };
}

let state = {
    screen: 'setup', mode: 'single', startTime: null,
    players: ["", "", "", ""], 
    totals: [0, 0, 0, 0], history: [], archives: [], currentRound: getInitialRound(),
    adisyon: getInitialAdisyon()
};

/* ============================================
   PRESENCE — GLOBAL & ROOM
   ============================================ */
const globalPresenceRef = db.ref('onlineUsers');
db.ref('.info/connected').on('value', snap => {
    if (snap.val() === true) {
        let conn = globalPresenceRef.push();
        conn.onDisconnect().remove();
        conn.set({ name: currentUser, device: deviceType, time: Date.now() });
    }
});
globalPresenceRef.on('value', snap => {
    activeUsersGlobal = snap.numChildren();
    updateFooterCounts();
});

function attachRoomPresence(roomId) {
    if (roomPresenceRef) roomPresenceRef.off();
    roomPresenceRef = db.ref('lobiler/' + roomId + '/onlineUsers');
    db.ref('.info/connected').on('value', snap => {
        if (snap.val() === true && roomId) {
            let conn = roomPresenceRef.push();
            conn.onDisconnect().remove();
            conn.set({ name: currentUser, device: deviceType, time: Date.now() });
        }
    });
    roomPresenceRef.on('value', snap => {
        activeUsersRoom = snap.numChildren();
        updateFooterCounts();
    });
}

function detachRoomPresence() {
    if (roomPresenceRef) {
        roomPresenceRef.off();
        roomPresenceRef = null;
    }
    activeUsersRoom = 0;
    updateFooterCounts();
}

function updateFooterCounts() {
    const el = $('#active-users-count');
    if (el) el.innerText = currentRoomId ? activeUsersRoom : activeUsersGlobal;
    const label = $('#active-users-label');
    if (label) label.innerText = currentRoomId ? 'Bu Masada' : 'Çevrimiçi';
}

/* ============================================
   LOBBY FUNCTIONS
   ============================================ */
function createRoom() {
    const nameInput = $('#new-room-name');
    const passInput = $('#new-room-pass');
    const name = nameInput ? nameInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';

    if (!name) {
        showToast('Masa ismi girmelisiniz!', 'error');
        return;
    }

    const roomId = generateId();
    const roomData = {
        meta: {
            name: name,
            password: password || null,
            createdAt: Date.now(),
            createdBy: currentUser
        },
        state: {
            screen: 'setup', mode: 'single', startTime: null,
            players: ["", "", "", ""], 
            totals: [0, 0, 0, 0], history: [], archives: [], 
            currentRound: getInitialRound(),
            adisyon: getInitialAdisyon()
        }
    };

    db.ref('lobiler/' + roomId).set(roomData)
        .then(() => {
            showToast('Masa kuruldu! Odaya yönlendiriliyorsunuz...', 'success');
            enterRoom(roomId);
        })
        .catch(err => {
            showToast('Masa kurulamadı: ' + err.message, 'error');
        });
}

function enterRoom(roomId) {
    currentRoomId = roomId;
    roomRef = db.ref('lobiler/' + roomId + '/state');
    attachRoomPresence(roomId);

    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            state = data;
            if (!state.adisyon) state.adisyon = getInitialAdisyon();
        }
        isDataLoaded = true;
        render();

        if (state.screen === 'game' && state.startTime && !timerInterval) {
            timerInterval = setInterval(updateLiveTimer, 1000);
        } else if (state.screen === 'setup' && timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    });
}

function leaveRoom() {
    if (!confirm('Masadan ayrılacaksınız. Emin misiniz?')) return;

    if (roomRef) {
        roomRef.off();
        roomRef = null;
    }
    detachRoomPresence();
    currentRoomId = null;
    isDataLoaded = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    state = {
        screen: 'setup', mode: 'single', startTime: null,
        players: ["", "", "", ""], 
        totals: [0, 0, 0, 0], history: [], archives: [], 
        currentRound: getInitialRound(),
        adisyon: getInitialAdisyon()
    };
    uiState = { showScoreboard: false, showCalc: false, showAdisyon: false, calcValue: "" };
    renderLobby();
    showToast('Lobiye döndünüz.', 'info');
}

function joinRoom(roomId, requiresPassword) {
    if (requiresPassword) {
        pendingJoinRoomId = roomId;
        $('#password-modal').classList.add('active');
        $('#password-modal-input').value = '';
        $('#password-modal-input').focus();
    } else {
        enterRoom(roomId);
    }
}

function confirmJoinWithPassword() {
    const pass = $('#password-modal-input').value.trim();
    if (!pass) {
        showToast('Şifre giriniz!', 'error');
        return;
    }
    db.ref('lobiler/' + pendingJoinRoomId + '/meta/password').once('value')
        .then(snap => {
            if (snap.val() === pass) {
                closePasswordModal();
                enterRoom(pendingJoinRoomId);
                pendingJoinRoomId = null;
            } else {
                showToast('Yanlış şifre!', 'error');
            }
        });
}

function closePasswordModal() {
    $('#password-modal').classList.remove('active');
    pendingJoinRoomId = null;
}

function deleteRoom(roomId) {
    if (!confirm('Bu masayı silmek istediğinize emin misiniz?')) return;
    db.ref('lobiler/' + roomId).remove()
        .then(() => showToast('Masa silindi.', 'success'))
        .catch(err => showToast('Silinemedi: ' + err.message, 'error'));
}

/* ============================================
   SAVE STATE
   ============================================ */
function saveState() { 
    if (isDataLoaded && roomRef) roomRef.set(state); 
}

function getPlayerName(idx) { 
    return state.players[idx] && state.players[idx].trim() !== "" ? state.players[idx] : `Oyuncu ${idx+1}`; 
}

function getTeamName(teamIdx) {
    let p1 = getPlayerName(teamIdx === 0 ? 0 : 2).split(' ')[0];
    let p2 = getPlayerName(teamIdx === 0 ? 1 : 3).split(' ')[0];
    if(p1 === "Oyuncu") p1 += (teamIdx === 0 ? "1" : "3");
    if(p2 === "Oyuncu") p2 += (teamIdx === 0 ? "2" : "4");
    return `${p1} & ${p2}`;
}

function getArchiveTeamName(archObj, teamIdx) {
    let p1 = (archObj.players[teamIdx === 0 ? 0 : 2] || `Oyuncu ${teamIdx === 0 ? 1 : 3}`).split(' ')[0];
    let p2 = (archObj.players[teamIdx === 0 ? 1 : 3] || `Oyuncu ${teamIdx === 0 ? 2 : 4}`).split(' ')[0];
    return `${p1} & ${p2}`;
}

/* ============================================
   SCORE INPUT HANDLERS
   ============================================ */
window.handleScoreInput = function(idx, value) { 
    state.currentRound[`p${idx}`].score = value; 
    saveState(); 
};
window.toggleState = function(idx, field) { 
    state.currentRound[`p${idx}`][field] = !state.currentRound[`p${idx}`][field]; 
    saveState(); 
};

window.handleQuickPenalty = function(idx, selectEl) {
    let val = parseInt(selectEl.value);
    if (!isNaN(val)) { 
        addPenalty(idx, val, `+${val}`); 
        selectEl.value = ""; 
    }
};

window.setMode = function(mode) { state.mode = mode; saveState(); }
window.setWinner = function(val) { 
    state.currentRound.winner = val; 
    if (val === "-1") { calculateRound(); return; } 
    saveState(); 
};
window.setWinType = function(val) { 
    if (state.currentRound.winner === "-1") return; 
    state.currentRound.winType = val; 
    calculateRound(); 
};

/* ============================================
   DRAWERS
   ============================================ */
window.toggleScoreboard = function() {
    uiState.showScoreboard = !uiState.showScoreboard;
    if(uiState.showScoreboard) { uiState.showCalc = false; uiState.showAdisyon = false; }
    updateDrawers();
};
window.toggleCalc = function() {
    uiState.showCalc = !uiState.showCalc;
    if(uiState.showCalc) { uiState.showScoreboard = false; uiState.showAdisyon = false; }
    updateDrawers();
};
window.toggleAdisyon = function() {
    uiState.showAdisyon = !uiState.showAdisyon;
    if(uiState.showAdisyon) { uiState.showScoreboard = false; uiState.showCalc = false; }
    updateDrawers();
};

function updateDrawers() {
    const scoreD = $('#score-drawer');
    const calcD = $('#calc-drawer');
    const adisD = $('#adisyon-drawer');
    if(scoreD) scoreD.classList.toggle('open', uiState.showScoreboard);
    if(calcD) calcD.classList.toggle('open', uiState.showCalc);
    if(adisD) adisD.classList.toggle('open', uiState.showAdisyon);

    if($('#score-icon')) $('#score-icon').innerText = uiState.showScoreboard ? '▼' : '▲';
    if($('#calc-icon')) $('#calc-icon').innerText = uiState.showCalc ? '▼' : '▲';
    if($('#adisyon-icon')) $('#adisyon-icon').innerText = uiState.showAdisyon ? '▼' : '▲';
}

/* ============================================
   CALCULATOR
   ============================================ */
window.calcPress = function(val) { 
    uiState.calcValue += val; 
    $('#calc-display').value = uiState.calcValue; 
};
window.calcClear = function() { 
    uiState.calcValue = ""; 
    $('#calc-display').value = uiState.calcValue; 
};
window.calcEval = function() { 
    try { 
        uiState.calcValue = eval(uiState.calcValue).toString(); 
        $('#calc-display').value = uiState.calcValue; 
    } catch(e) { 
        $('#calc-display').value = "Hata"; 
        uiState.calcValue = ""; 
    } 
};

/* ============================================
   TIMER
   ============================================ */
function updateLiveTimer() {
    if(!state.startTime) return;
    const timerEl = $('#live-timer');
    if(timerEl) {
        let diff = Math.floor((Date.now() - state.startTime) / 1000);
        let m = Math.floor(diff / 60).toString().padStart(2, '0');
        let s = (diff % 60).toString().padStart(2, '0');
        let h = Math.floor(diff / 3600);
        timerEl.innerText = h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    }
}

/* ============================================
   ROUND CALCULATION (PRESERVED EXACTLY)
   ============================================ */
window.calculateRound = function() {
    let winnerIdx = parseInt(state.currentRound.winner);
    let winType = state.currentRound.winType;
    let roundScores = [0, 0, 0, 0];
    let winnerWentDouble = winnerIdx >= 0 ? state.currentRound[`p${winnerIdx}`].double : false;

    let partnerIdx = -1;
    if (winnerIdx === 0) partnerIdx = 1; else if (winnerIdx === 1) partnerIdx = 0;
    else if (winnerIdx === 2) partnerIdx = 3; else if (winnerIdx === 3) partnerIdx = 2;

    for (let i = 0; i < 4; i++) {
        let p = state.currentRound[`p${i}`];
        if (i === winnerIdx) {
            if (winType === 'normal') roundScores[i] = -101;
            else if (winType === 'joker' || winType === 'elden') roundScores[i] = -202;
            else if (winType === 'elden_joker') roundScores[i] = -404;
            continue;
        }
        if (state.mode === 'team' && i === partnerIdx) { roundScores[i] = 0; continue; }

        let basePenalty = (p.score === "") ? 202 : (parseInt(p.score) || 0);
        let mult = 1;

        if (p.double) mult *= 2; 
        if (winnerWentDouble) mult *= 2; 
        if (winType === 'joker' || winType === 'elden') mult *= 2; 
        if (winType === 'elden_joker') mult *= 4; 

        roundScores[i] = basePenalty * mult;
    }

    for (let i = 0; i < 4; i++) state.totals[i] += roundScores[i];

    let typeLabels = { "normal": "Normal", "joker": "Joker", "elden": "Elden", "elden_joker": "Elden+Jkr" };
    let pColor = state.mode === 'team' ? ((winnerIdx==0 || winnerIdx==1)?'text-team-a':'text-team-b') : '';
    let detailText = winnerIdx === -1 ? "Kimse Bitemedi" : `<span class="${pColor}">${getPlayerName(winnerIdx)}</span> (${typeLabels[winType]})`;

    if (!state.history) state.history = [];
    state.history.push({ 
        type: 'round', 
        id: generateId(),
        roundNum: state.history.filter(h => h.type === 'round').length + 1, 
        scores: roundScores, 
        details: detailText, 
        winnerIdx: winnerIdx 
    });

    state.currentRound = getInitialRound();
    saveState();
    showToast('El hesaplandı!', 'success');
};

window.addPenalty = function(idx, amt, reason) {
    state.totals[idx] += amt;
    if (!state.history) state.history = [];
    state.history.push({ 
        type: 'penalty', 
        id: generateId(),
        playerIdx: idx, 
        amount: amt, 
        reason: reason 
    });
    saveState();
    showToast(`${getPlayerName(idx)}: ${amt} ceza eklendi`, 'warning');
};

window.askCustomPenalty = function(idx) {
    let amt = prompt(`${getPlayerName(idx)} için özel ceza puanı (Örn: 50):`);
    if (amt && !isNaN(amt)) addPenalty(idx, parseInt(amt), 'Ceza');
};

/* ============================================
   SCORE EDIT / DELETE
   ============================================ */
window.editHistoryEntry = function(index) {
    const h = state.history[index];
    if (!h) return;

    editTargetIndex = index;
    editTargetType = h.type;

    const modal = $('#edit-modal');
    const desc = $('#edit-modal-desc');
    const input = $('#edit-modal-input');

    if (h.type === 'round') {
        desc.innerHTML = `El #${h.roundNum} skorlarını düzenle. Tek tek değiştirmek için oyuncu skorunu girin, toplamı değiştirmek için toplam farkı girin.`;
        input.value = h.scores.join(', ');
        input.placeholder = "0, 0, 0, 0 veya toplam fark";
    } else {
        desc.innerHTML = `${getPlayerName(h.playerIdx)} için ${h.reason} cezasını düzenle.`;
        input.value = h.amount;
        input.placeholder = "Yeni ceza değeri";
    }

    modal.classList.add('active');
    input.focus();
};

window.confirmEditScore = function() {
    if (editTargetIndex === null) return;
    const h = state.history[editTargetIndex];
    const input = $('#edit-modal-input');
    const newVal = input.value.trim();

    if (!newVal && newVal !== '0') {
        closeEditModal();
        return;
    }

    if (h.type === 'round') {
        if (newVal.includes(',')) {
            const newScores = newVal.split(',').map(s => parseInt(s.trim()) || 0);
            if (newScores.length === 4) {
                for (let i = 0; i < 4; i++) {
                    const diff = newScores[i] - h.scores[i];
                    state.totals[i] += diff;
                    h.scores[i] = newScores[i];
                }
                showToast('El skorları güncellendi!', 'success');
            }
        }
    } else {
        const newAmt = parseInt(newVal) || 0;
        const diff = newAmt - h.amount;
        state.totals[h.playerIdx] += diff;
        h.amount = newAmt;
        showToast('Ceza güncellendi!', 'success');
    }

    saveState();
    closeEditModal();
};

window.closeEditModal = function() {
    $('#edit-modal').classList.remove('active');
    editTargetIndex = null;
    editTargetType = null;
};

window.deleteHistoryEntry = function(index) {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz? Toplamlar geri alınacak.')) return;

    const h = state.history[index];
    if (!h) return;

    if (h.type === 'round') {
        for (let i = 0; i < 4; i++) {
            state.totals[i] -= h.scores[i];
        }
    } else {
        state.totals[h.playerIdx] -= h.amount;
    }

    state.history.splice(index, 1);
    saveState();
    showToast('Kayıt silindi.', 'info');
};

/* ============================================
   FINISH & ARCHIVE
   ============================================ */
window.finishAndArchive = function() {
    if(!confirm('Oyun sıfırlanacak ve veritabanı arşivine eklenecek, emin misiniz?')) return;

    let durationMins = state.startTime ? Math.floor((Date.now() - state.startTime) / 60000) : 0;
    if(!state.archives) state.archives = [];
    state.archives.push({ 
        date: new Date().toLocaleString('tr-TR'), 
        mode: state.mode, 
        players: state.players, 
        totals: state.totals, 
        history: state.history,
        duration: durationMins,
        adisyon: state.adisyon
    });

    state.screen = 'setup'; 
    state.startTime = null; 
    state.players = ["", "", "", ""];
    state.totals = [0, 0, 0, 0]; 
    state.history = []; 
    state.currentRound = getInitialRound();
    state.adisyon = getInitialAdisyon();
    saveState();
    showToast('Maç arşive eklendi!', 'success');
};

/* ============================================
   STATS
   ============================================ */
function getStats(pIdx1, pIdx2 = -1) {
    let wins = 0; let pens = 0;
    (state.history || []).forEach(h => {
        if(h.type === 'round' && (h.winnerIdx == pIdx1 || h.winnerIdx == pIdx2)) wins++;
        if(h.type === 'penalty' && (h.playerIdx == pIdx1 || h.playerIdx == pIdx2) && h.amount > 0) pens += h.amount;
    });
    return { wins, pens };
}

/* ============================================
   ADISYON FUNCTIONS
   ============================================ */
window.updateAdisyonQty = function(itemId, delta) {
    if (!state.adisyon) state.adisyon = getInitialAdisyon();
    const item = state.adisyon.items.find(i => i.id === itemId);
    if (item) {
        item.qty = Math.max(0, item.qty + delta);
        saveState();
        renderAdisyon();
    }
};

window.updateCustomTotal = function(val) {
    if (!state.adisyon) state.adisyon = getInitialAdisyon();
    state.adisyon.customTotal = parseInt(val) || 0;
    saveState();
    renderAdisyon();
};

function getAdisyonTotal() {
    if (!state.adisyon) return 0;
    const itemsTotal = state.adisyon.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    return itemsTotal + (state.adisyon.customTotal || 0);
}

function renderAdisyon() {
    const container = $('#adisyon-content');
    if (!container) return;

    const total = getAdisyonTotal();
    let itemsHtml = '';

    if (state.adisyon && state.adisyon.items) {
        itemsHtml = state.adisyon.items.map(item => `
            <div class="adisyon-item">
                <div class="item-icon">${item.icon}</div>
                <div class="item-name">${item.name}</div>
                <div class="item-price">${item.price}₺</div>
                <div class="adisyon-controls">
                    <button class="btn-danger btn-small" onclick="updateAdisyonQty('${item.id}', -1)">−</button>
                    <span class="qty">${item.qty}</span>
                    <button class="btn-success btn-small" onclick="updateAdisyonQty('${item.id}', 1)">+</button>
                </div>
            </div>
        `).join('');
    }

    container.innerHTML = `
        <div class="adisyon-grid">${itemsHtml}</div>
        <div style="margin-bottom:12px;">
            <input type="number" placeholder="Ekstra tutar (Örn: 50)" 
                value="${state.adisyon?.customTotal || ''}" 
                onchange="updateCustomTotal(this.value)">
        </div>
        <div class="adisyon-total">
            <h4>Toplam Adisyon</h4>
            <div class="big-total">${total}₺</div>
        </div>
    `;
}

/* ============================================
   LOBBY RENDER
   ============================================ */
function renderLobby() {
    const app = $('#app');

    app.innerHTML = `
        <div class="lobby-header screen-enter">
            <div class="logo">🎲</div>
            <h1>101 OKEY PRO</h1>
            <p>Canlı Çoklu Masa Sistemi</p>
        </div>

        <div class="card screen-enter" style="animation-delay:0.1s">
            <div style="text-align:center; margin-bottom:16px;">
                <div class="user-badge" onclick="editUserName()">
                    👤 <input type="text" id="user-name-input" value="${currentUser}" 
                        onchange="saveUserName(this.value)" onclick="event.stopPropagation()">
                </div>
                <p style="font-size:12px; color:var(--text-muted);">İsminizi değiştirmek için üzerine tıklayın</p>
            </div>

            <h3>🆕 Yeni Masa Kur</h3>
            <div class="room-form">
                <input type="text" id="new-room-name" placeholder="Masa İsmi (Örn: Cuma Akşamı)">
                <input type="password" id="new-room-pass" placeholder="Şifre (Opsiyonel)">
                <button class="btn-primary btn-glow" onclick="createRoom()">MASAYI KUR</button>
            </div>
        </div>

        <div class="card screen-enter" style="animation-delay:0.2s">
            <h3>🚪 Aktif Masalar</h3>
            <div id="room-list" class="room-list">
                <div class="loading-screen" style="min-height:auto; padding:30px;">
                    <div class="spinner" style="width:30px; height:30px; border-width:3px;"></div>
                    <p style="font-size:13px;">Masalar yükleniyor...</p>
                </div>
            </div>
        </div>

        <div class="footer-info">
            <div class="footer-badge">🟢 <span id="active-users-label">Çevrimiçi</span>: <strong id="active-users-count" style="color:var(--success);">${activeUsersGlobal}</strong></div>
            <div class="footer-badge">${deviceType}</div>
            <div class="footer-badge">IP: <strong>${clientIP}</strong></div>
        </div>
    `;

    loadRoomList();
}

function editUserName() {
    const input = $('#user-name-input');
    if (input) {
        input.focus();
        input.select();
    }
}

window.saveUserName = function(name) {
    if (setUserName(name)) {
        currentUser = name.trim();
        showToast(`İsminiz "${currentUser}" olarak güncellendi!`, 'success');
    }
};

function loadRoomList() {
    const listEl = $('#room-list');
    if (!listEl) return;

    db.ref('lobiler').on('value', snap => {
        const rooms = snap.val();
        if (!rooms || Object.keys(rooms).length === 0) {
            listEl.innerHTML = `
                <div class="empty-rooms">
                    <span class="emoji">🍃</span>
                    <p>Henüz açık masa yok.<br>İlk masayı siz kurun!</p>
                </div>
            `;
            return;
        }

        const roomArray = Object.entries(rooms).map(([id, data]) => ({ id, ...data }));
        roomArray.sort((a, b) => (b.meta?.createdAt || 0) - (a.meta?.createdAt || 0));

        listEl.innerHTML = roomArray.map((room, idx) => {
            const hasPass = room.meta && room.meta.password;
            const onlineCount = room.onlineUsers ? Object.keys(room.onlineUsers).length : 0;
            const isOwner = room.meta && room.meta.createdBy === currentUser;

            return `
                <div class="room-item" style="animation: cardEnter 0.4s ease-out both ${idx * 0.05}s;" 
                     onclick="joinRoom('${room.id}', ${hasPass ? 'true' : 'false'})">
                    <div class="room-item-info">
                        <h4>
                            ${room.meta?.name || 'İsimsiz Masa'}
                            ${hasPass ? '<span class="room-lock">🔒</span>' : ''}
                        </h4>
                        <span>Kurucu: ${room.meta?.createdBy || 'Bilinmiyor'} • ${new Date(room.meta?.createdAt).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div class="room-item-meta">
                        <div class="room-count">
                            👥 ${onlineCount}
                        </div>
                        ${isOwner ? `<button class="btn-danger btn-small" style="width:auto; padding:6px 10px; font-size:12px;" onclick="event.stopPropagation(); deleteRoom('${room.id}')">🗑️</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    });
}

/* ============================================
   MAIN RENDER
   ============================================ */
window.render = function() {
    if (!currentRoomId) {
        renderLobby();
        return;
    }

    const app = $('#app');
    const roomName = state.roomName || 'Masa';

    const footerHTML = `
        <div class="footer-info">
            <div class="footer-badge">🟢 <span id="active-users-label">Bu Masada</span>: <strong id="active-users-count" style="color:var(--success);">${activeUsersRoom}</strong></div>
            <div class="footer-badge">${deviceType}</div>
            <div class="footer-badge">IP: <strong>${clientIP}</strong></div>
        </div>
    `;

    if (state.screen === 'setup') {
        app.innerHTML = `
            <div class="game-header screen-enter">
                <div>
                    <h2>🎲 Masa Kurulumu</h2>
                    <div class="room-name">${roomName}</div>
                </div>
                <div class="header-actions">
                    <button class="btn-outline btn-icon" onclick="copyRoomLink()">🔗</button>
                    <button class="btn-danger btn-icon" onclick="leaveRoom()">🚪 Çık</button>
                </div>
            </div>

            <div class="card screen-enter" style="animation-delay:0.1s">
                <div class="fast-select-group" style="margin-bottom:20px;">
                    <button class="btn-select ${state.mode === 'single' ? 'active' : ''}" onclick="setMode('single')">Tekli Oyun</button>
                    <button class="btn-select ${state.mode === 'team' ? 'active' : ''}" onclick="setMode('team')">Eşli Oyun (1-2 / 3-4)</button>
                </div>
                ${state.players.map((p, i) => `
                    <input type="text" value="${p}" onchange="state.players[${i}]=this.value; saveState();" placeholder="${i+1}. Oyuncu İsmi (Boş bırakılabilir)">
                `).join('')}
                <button class="btn-primary btn-glow" style="margin-top:10px;" onclick="state.screen='game'; state.startTime=Date.now(); saveState();">MASAYI BAŞLAT</button>
            </div>

            <div class="card screen-enter" style="animation-delay:0.2s">
                <h3>📦 Bulut Maç Arşivi</h3>
                ${(!state.archives || state.archives.length === 0) ? '<p style="text-align:center; font-size:13px; color:var(--text-muted); margin-top:10px;">Henüz tamamlanmış maç yok.</p>' : state.archives.slice().reverse().map((a) => {
                    let isTeam = a.mode === 'team'; 
                    let tA = a.totals[0] + a.totals[1]; 
                    let tB = a.totals[2] + a.totals[3];
                    let winnerText = ""; 
                    let bgClass = "";

                    if(isTeam) {
                        let teamA = getArchiveTeamName(a, 0); 
                        let teamB = getArchiveTeamName(a, 1);
                        if(tA < tB) { winnerText = `🏆 ${teamA}`; bgClass = "bg-team-a-light border-team-a"; }
                        else if(tB < tA) { winnerText = `🏆 ${teamB}`; bgClass = "bg-team-b-light border-team-b"; }
                        else winnerText = "🤝 Berabere";
                    } else {
                        let min = Math.min(...a.totals); 
                        let wIdx = a.totals.indexOf(min);
                        winnerText = `🏆 ${a.players[wIdx] || 'Oyuncu ' + (wIdx+1)}`;
                    }

                    let adisyonText = '';
                    if (a.adisyon) {
                        const adTotal = (a.adisyon.items || []).reduce((s, i) => s + (i.price * i.qty), 0) + (a.adisyon.customTotal || 0);
                        if (adTotal > 0) adisyonText = `<div style="margin-top:6px; font-size:12px; color:var(--text-muted);">🧾 Adisyon: ${adTotal}₺</div>`;
                    }

                    return `
                    <div class="${bgClass}" style="border:1px solid var(--border); padding:12px; margin-bottom:10px; border-radius:12px; font-size:13px; background:rgba(255,255,255,0.03);">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid var(--border); padding-bottom:5px;">
                            <strong style="color:var(--primary-light);">${a.date} (${a.duration} dk)</strong>
                            <strong>${winnerText}</strong>
                        </div>
                        ${isTeam ? `<span class="${tA < tB ? 'text-team-a' : ''}">${getArchiveTeamName(a,0)}: ${tA}</span> | <span class="${tB < tA ? 'text-team-b' : ''}">${getArchiveTeamName(a,1)}: ${tB}</span>` : a.totals.join(' | ')}
                        ${adisyonText}
                    </div>`
                }).join('')}
            </div>
            ${footerHTML}
        `;
        return;
    }

    let scoreboardHTML = "";
    if(state.mode === 'team') {
        let sA = getStats(0, 1); 
        let sB = getStats(2, 3);
        scoreboardHTML = `
            <div class="score-box bg-team-a" style="grid-column: span 2;">
                <h4>${getTeamName(0)}</h4><div class="total">${state.totals[0]+state.totals[1]}</div>
                <div class="stat-detail" style="border-top:1px solid rgba(255,255,255,0.2); padding-top:8px; margin-top:8px;">
                    ${getPlayerName(0).substring(0,8)}: <strong>${state.totals[0]}</strong> | ${getPlayerName(1).substring(0,8)}: <strong>${state.totals[1]}</strong><br>
                    Biten El: ${sA.wins} | Yenen Ceza: ${sA.pens}
                </div>
            </div>
            <div class="score-box bg-team-b" style="grid-column: span 2;">
                <h4>${getTeamName(2)}</h4><div class="total">${state.totals[2]+state.totals[3]}</div>
                <div class="stat-detail" style="border-top:1px solid rgba(255,255,255,0.2); padding-top:8px; margin-top:8px;">
                    ${getPlayerName(2).substring(0,8)}: <strong>${state.totals[2]}</strong> | ${getPlayerName(3).substring(0,8)}: <strong>${state.totals[3]}</strong><br>
                    Biten El: ${sB.wins} | Yenen Ceza: ${sB.pens}
                </div>
            </div>`;
    } else {
        scoreboardHTML = [0,1,2,3].map(i => {
            let s = getStats(i);
            return `<div class="score-box">
                <h4>${getPlayerName(i).substring(0,8)}</h4><div class="total">${state.totals[i]}</div>
                <div class="stat-detail" style="border-top:1px solid var(--border); padding-top:8px; margin-top:8px;">Biten: ${s.wins} | Cz: ${s.pens}</div>
            </div>`;
        }).join('');
    }

    let btnA = state.mode === 'team' ? 'bg-team-a-light text-team-a' : '';
    let btnB = state.mode === 'team' ? 'bg-team-b-light text-team-b' : '';

    let penaltyOptions = `<option value="">+ Hızlı Ceza Seç</option>`;
    for(let v=10; v<=260; v+=10) penaltyOptions += `<option value="${v}">+${v} Ceza</option>`;

    app.innerHTML = `
        <div class="game-header screen-enter">
            <div>
                <h2>🎯 El Girişi</h2>
                <div class="room-name">${roomName}</div>
            </div>
            <div class="header-actions">
                <span class="live-timer" id="live-timer">00:00</span>
                <button class="btn-outline btn-icon" onclick="copyRoomLink()">🔗</button>
                <button class="btn-danger btn-icon" onclick="leaveRoom()">🚪 Çık</button>
            </div>
        </div>

        <div class="card screen-enter" style="animation-delay:0.1s">
            <div class="players-grid">
                ${[0,1,2,3].map(i => `
                    <div class="player-card ${state.mode==='team'?(i<2?'border-team-a':'border-team-b'):''}">
                        <h4 class="${state.mode==='team'?(i<2?'text-team-a':'text-team-b'):''}">${getPlayerName(i).substring(0,12)}</h4>

                        <button class="btn-toggle ${state.currentRound[`p${i}`].double ? 'active' : ''}" style="width:100%; margin-bottom:10px;" onclick="toggleState(${i}, 'double')">Çifte Gitti</button>
                        <input type="number" id="score-input-${i}" placeholder="Eldeki Sayı (Boş=202)" value="${state.currentRound[`p${i}`].score}" onchange="handleScoreInput(${i}, this.value)">

                        <select class="select-penalty" onchange="handleQuickPenalty(${i}, this)">
                            ${penaltyOptions}
                        </select>

                        <div class="penalty-actions">
                            <button class="btn-danger btn-small" onclick="addPenalty(${i}, 101, '+101')">+101</button>
                            <button class="btn-outline btn-small" onclick="askCustomPenalty(${i})">Özel</button>
                        </div>
                    </div>`).join('')}
            </div>
        </div>

        <div class="card screen-enter" style="border: 2px dashed var(--primary); background: rgba(139,92,246,0.05); animation-delay:0.15s">
            <h3>🏁 Eli Bitir</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px; text-align:center;">Kim Bitti?</p>
            <div class="winner-cols">
                <div class="winner-col">
                    <button id="win-btn-0" class="btn-select btn-winner ${state.currentRound.winner == '0' ? 'active' : ''} ${btnA}" onclick="setWinner('0')">${getPlayerName(0).substring(0,8)}</button>
                    <button id="win-btn-1" class="btn-select btn-winner ${state.currentRound.winner == '1' ? 'active' : ''} ${btnA}" onclick="setWinner('1')">${getPlayerName(1).substring(0,8)}</button>
                </div>
                <div class="winner-col">
                    <button id="win-btn-2" class="btn-select btn-winner ${state.currentRound.winner == '2' ? 'active' : ''} ${btnB}" onclick="setWinner('2')">${getPlayerName(2).substring(0,8)}</button>
                    <button id="win-btn-3" class="btn-select btn-winner ${state.currentRound.winner == '3' ? 'active' : ''} ${btnB}" onclick="setWinner('3')">${getPlayerName(3).substring(0,8)}</button>
                </div>
            </div>
            <button id="win-btn--1" class="btn-select btn-winner btn-nobody ${state.currentRound.winner == '-1' ? 'active' : ''}" style="width:100%; margin-top:5px;" onclick="setWinner('-1')">BİTEN YOK</button>

            <div id="win-type-group" style="${state.currentRound.winner === '-1' ? 'opacity:0.4; pointer-events:none;' : ''}">
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px; text-align:center; margin-top:15px;">Nasıl Bitti?</p>
                <button id="type-btn-normal" class="btn-select btn-type ${state.currentRound.winType == 'normal' ? 'active' : ''}" style="width:100%; margin-bottom:10px;" onclick="setWinType('normal')">Normal</button>
                <div class="win-type-bottom">
                    <button id="type-btn-joker" class="btn-select btn-type ${state.currentRound.winType == 'joker' ? 'active' : ''}" onclick="setWinType('joker')">Joker</button>
                    <button id="type-btn-elden" class="btn-select btn-type ${state.currentRound.winType == 'elden' ? 'active' : ''}" onclick="setWinType('elden')">Elden</button>
                    <button id="type-btn-elden_joker" class="btn-select btn-type ${state.currentRound.winType == 'elden_joker' ? 'active' : ''}" onclick="setWinType('elden_joker')">Elden+Jkr</button>
                </div>
            </div>
        </div>

        <div class="card screen-enter" style="margin-bottom:30px; animation-delay:0.2s">
            <h3>📜 Bu Maçın Geçmişi</h3>
            <div style="overflow-x:auto;">
                <table class="history-table">
                    <thead><tr><th>El</th>${[0,1,2,3].map(i=>`<th>${getPlayerName(i).substring(0,6)}</th>`).join('')}<th>İşlem</th></tr></thead>
                    <tbody>${(state.history || []).slice().reverse().map((h, revIdx) => {
                        const realIdx = (state.history || []).length - 1 - revIdx;
                        if(h.type === 'round') {
                            let rowClass = (state.mode === 'team' && h.winnerIdx !== "-1") ? ((h.winnerIdx == 0 || h.winnerIdx == 1) ? 'history-team-a' : 'history-team-b') : '';
                            return `<tr class="${rowClass}"><td><strong>${h.roundNum}</strong><span class="history-detail">${h.details}</span></td>${h.scores.map(s=>`<td>${s}</td>`).join('')}<td><div class="history-actions"><button class="btn-edit" onclick="editHistoryEntry(${realIdx})">✏️</button><button class="btn-delete" onclick="deleteHistoryEntry(${realIdx})">🗑️</button></div></td></tr>`;
                        } else {
                            let pClass = state.mode === 'team' ? ((h.playerIdx == 0 || h.playerIdx == 1) ? 'text-team-a' : 'text-team-b') : '';
                            return `<tr style="background:rgba(239,68,68,0.1)"><td colspan="4" style="text-align:left; padding-left:10px;"><strong class="${pClass}">${getPlayerName(h.playerIdx)}</strong>: ${h.amount} (${h.reason})</td><td><div class="history-actions"><button class="btn-edit" onclick="editHistoryEntry(${realIdx})">✏️</button><button class="btn-delete" onclick="deleteHistoryEntry(${realIdx})">🗑️</button></div></td></tr>`;
                        }
                    }).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn-danger" style="margin-top: 15px;" onclick="finishAndArchive()">MAÇI SIFIRLA VE ARŞİVE AL</button>
        </div>

        <div id="calc-drawer" class="bottom-drawer ${uiState.showCalc ? 'open' : ''}">
            <button class="drawer-toggle toggle-calc" onclick="toggleCalc()">
                🧮 Hesap Makinesi <span id="calc-icon">${uiState.showCalc ? '▼' : '▲'}</span>
            </button>
            <div class="calc-container">
                <input type="text" id="calc-display" class="calc-display" value="${uiState.calcValue}" readonly>
                <div class="calc-grid">
                    <button class="calc-btn" onclick="calcPress('7')">7</button><button class="calc-btn" onclick="calcPress('8')">8</button><button class="calc-btn" onclick="calcPress('9')">9</button><button class="calc-btn calc-btn-op" onclick="calcPress('/')">÷</button>
                    <button class="calc-btn" onclick="calcPress('4')">4</button><button class="calc-btn" onclick="calcPress('5')">5</button><button class="calc-btn" onclick="calcPress('6')">6</button><button class="calc-btn calc-btn-op" onclick="calcPress('*')">×</button>
                    <button class="calc-btn" onclick="calcPress('1')">1</button><button class="calc-btn" onclick="calcPress('2')">2</button><button class="calc-btn" onclick="calcPress('3')">3</button><button class="calc-btn calc-btn-op" onclick="calcPress('-')">−</button>
                    <button class="calc-btn calc-btn-c" onclick="calcClear()">C</button><button class="calc-btn" onclick="calcPress('0')">0</button><button class="calc-btn calc-btn-eq" onclick="calcEval()">=</button><button class="calc-btn calc-btn-op" onclick="calcPress('+')">+</button>
                </div>
            </div>
        </div>

        <div id="score-drawer" class="bottom-drawer ${uiState.showScoreboard ? 'open' : ''}">
            <button class="drawer-toggle toggle-score" onclick="toggleScoreboard()">
                📊 Skor Tablosu <span id="score-icon">${uiState.showScoreboard ? '▼' : '▲'}</span>
            </button>
            <div class="scoreboard ${state.mode==='team'?'team-mode':''}">
                ${scoreboardHTML}
            </div>
        </div>

        <div id="adisyon-drawer" class="bottom-drawer ${uiState.showAdisyon ? 'open' : ''}">
            <button class="drawer-toggle toggle-adisyon" onclick="toggleAdisyon()">
                🧾 Adisyon <span id="adisyon-icon">${uiState.showAdisyon ? '▼' : '▲'}</span>
            </button>
            <div id="adisyon-content" class="adisyon-container">
                <!-- Rendered dynamically -->
            </div>
        </div>

        ${footerHTML}
    `;

    updateDrawers(); 
    updateLiveTimer();
    renderAdisyon();
}

/* ============================================
   ROOM LINK COPY
   ============================================ */
window.copyRoomLink = function() {
    if (!currentRoomId) return;
    const url = window.location.origin + window.location.pathname + '?room=' + currentRoomId;
    copyToClipboard(url);
};

/* ============================================
   INIT
   ============================================ */
function init() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');

    if (roomParam) {
        db.ref('lobiler/' + roomParam).once('value').then(snap => {
            if (snap.exists()) {
                const meta = snap.val().meta;
                if (meta && meta.password) {
                    pendingJoinRoomId = roomParam;
                    renderLobby();
                    setTimeout(() => {
                        $('#password-modal').classList.add('active');
                        $('#password-modal-input').focus();
                    }, 500);
                } else {
                    enterRoom(roomParam);
                }
            } else {
                showToast('Masa bulunamadı!', 'error');
                renderLobby();
            }
        });
    } else {
        renderLobby();
    }
}

// Expose all functions to window for inline onclick handlers
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.confirmJoinWithPassword = confirmJoinWithPassword;
window.closePasswordModal = closePasswordModal;
window.deleteRoom = deleteRoom;
window.saveUserName = saveUserName;
window.editHistoryEntry = editHistoryEntry;
window.confirmEditScore = confirmEditScore;
window.closeEditModal = closeEditModal;
window.deleteHistoryEntry = deleteHistoryEntry;
window.updateAdisyonQty = updateAdisyonQty;
window.updateCustomTotal = updateCustomTotal;
window.copyRoomLink = copyRoomLink;
window.calculateRound = calculateRound;
window.addPenalty = addPenalty;
window.askCustomPenalty = askCustomPenalty;
window.finishAndArchive = finishAndArchive;
window.toggleScoreboard = toggleScoreboard;
window.toggleCalc = toggleCalc;
window.toggleAdisyon = toggleAdisyon;
window.calcPress = calcPress;
window.calcClear = calcClear;
window.calcEval = calcEval;
window.setMode = setMode;
window.setWinner = setWinner;
window.setWinType = setWinType;
window.handleScoreInput = handleScoreInput;
window.toggleState = toggleState;
window.handleQuickPenalty = handleQuickPenalty;

init();
