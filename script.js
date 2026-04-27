// === FIREBASE BAĞLANTISI ===
const firebaseConfig = {
    // Projenin URL'si:
    databaseURL: "https://okey-ef015-default-rtdb.europe-west1.firebasedatabase.app/"
};

// Firebase'i başlat
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
// Tüm oyunu 'canliMasa' adlı bir dosya (node) altında tutuyoruz
const gameRef = db.ref('canliMasa'); 

// === UYGULAMA DURUMU ===
function getInitialRound() {
    return {
        p0: { opened: false, double: false, score: "" }, p1: { opened: false, double: false, score: "" },
        p2: { opened: false, double: false, score: "" }, p3: { opened: false, double: false, score: "" },
        winner: "-1", winType: "normal"
    };
}

let state = {
    screen: 'setup', mode: 'single', showScoreboard: false,
    players: ["1. Oyuncu", "2. Oyuncu", "3. Oyuncu", "4. Oyuncu"],
    totals: [0, 0, 0, 0], history: [], currentRound: getInitialRound()
};

let isDataLoaded = false;

// 1. Firebase'den Canlı Veri Dinleme (Biri değiştirdiği an burası tetiklenir)
gameRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        state = data; // Buluttaki veriyi kendi ekranımıza al
    }
    isDataLoaded = true;
    render(); // Ekranı güncelle
});

// 2. Firebase'e Veri Gönderme
function saveState() {
    if (isDataLoaded) {
        gameRef.set(state); // Herkesin ekranını günceller
    }
}

// === AKSİYON FONKSİYONLARI ===

// oninput yerine onchange kullanıyoruz ki rakam yazarken başkası güncellerse klavyen gitmesin.
window.handleScoreInput = function(idx, value) {
    state.currentRound[`p${idx}`].score = value;
    saveState();
};

window.toggleState = function(idx, field) {
    state.currentRound[`p${idx}`][field] = !state.currentRound[`p${idx}`][field];
    
    // OTOMASYON: Çift'e basınca Açtı da aktif olsun
    if (field === 'double' && state.currentRound[`p${idx}`].double) {
        state.currentRound[`p${idx}`].opened = true;
    }
    saveState();
};

window.setMode = function(mode) {
    state.mode = mode;
    saveState();
}

window.setWinner = function(val) {
    state.currentRound.winner = val;
    
    // OTOMASYON: "Biten Yok" seçilirse beklemeye gerek yok, anında hesapla!
    if (val === "-1") {
        calculateRound();
        return;
    }
    saveState();
};

window.setWinType = function(val) {
    if (state.currentRound.winner === "-1") return; // Kimse bitmediyse işlem yapma
    state.currentRound.winType = val;
    
    // OTOMASYON: Bitiş türü seçildiği an anında hesapla ve geçmişe aktar!
    calculateRound();
};

window.toggleScoreboard = function() {
    state.showScoreboard = !state.showScoreboard;
    saveState();
};

// === HESAPLAMA MOTORU ===
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

        let basePenalty = !p.opened ? 202 : (parseInt(p.score) || 0);
        let mult = 1;
        if (p.double) mult *= 2; 
        if (winnerWentDouble) mult *= 2; 
        if (winType === 'joker' || winType === 'elden') mult *= 2; 
        if (winType === 'elden_joker') mult *= 4; 

        roundScores[i] = basePenalty * mult;
    }

    for (let i = 0; i < 4; i++) state.totals[i] += roundScores[i];
    
    let typeLabels = { "normal": "Normal", "joker": "Joker", "elden": "Elden", "elden_joker": "Elden+Jkr" };
    let detailText = winnerIdx === -1 ? "Kimse Bitemedi" : `${state.players[winnerIdx]} (${typeLabels[winType]})`;

    // History (Eğer yoksa oluştur)
    if (!state.history) state.history = [];
    state.history.push({ type: 'round', roundNum: state.history.filter(h => h.type === 'round').length + 1, scores: roundScores, details: detailText });
    
    state.currentRound = getInitialRound();
    saveState();
};

window.addPenalty = function(idx, amt, reason) {
    state.totals[idx] += amt;
    if (!state.history) state.history = [];
    state.history.push({ type: 'penalty', playerIdx: idx, amount: amt, reason: reason });
    saveState();
};

window.askCustomPenalty = function(idx) {
    let amt = prompt(`${state.players[idx]} için özel ceza puanı (Örn: 50):`);
    if (amt && !isNaN(amt)) addPenalty(idx, parseInt(amt), 'Ceza');
};

window.finishAndArchive = function() {
    if(!confirm('Oyun sıfırlanacak, emin misiniz? (Arşiv yerel hafızaya kaydedilir)')) return;
    
    // Arşivi kendi telefonunun yerel hafızasına al (Firebase'i şişirmemek için)
    let arch = JSON.parse(localStorage.getItem('okey101Archives')) || [];
    arch.push({ date: new Date().toLocaleString('tr-TR'), mode: state.mode, players: state.players, totals: state.totals, history: state.history });
    localStorage.setItem('okey101Archives', JSON.stringify(arch));
    
    // Firebase'deki canlı masayı sıfırla!
    state = {
        screen: 'setup', mode: 'single', showScoreboard: false,
        players: ["1. Oyuncu", "2. Oyuncu", "3. Oyuncu", "4. Oyuncu"],
        totals: [0, 0, 0, 0], history: [], currentRound: getInitialRound()
    };
    saveState();
};

// === RENDER EKRANI ===
window.render = function() {
    const app = document.getElementById('app');
    
    // 1. KURULUM EKRANI
    if (state.screen === 'setup') {
        let arch = JSON.parse(localStorage.getItem('okey101Archives')) || [];
        app.innerHTML = `
            <div class="card">
                <h1>101 OKEY</h1>
                <div class="fast-select-group" style="margin-bottom:20px;">
                    <button class="btn-select ${state.mode === 'single' ? 'active' : ''}" onclick="setMode('single')">Tekli Oyun</button>
                    <button class="btn-select ${state.mode === 'team' ? 'active' : ''}" onclick="setMode('team')">Eşli Oyun (1-2 / 3-4)</button>
                </div>
                ${state.players.map((p, i) => `
                    <input type="text" value="${p}" onchange="state.players[${i}]=this.value; saveState();" placeholder="${i+1}. Oyuncu İsmi">
                `).join('')}
                <button class="btn-primary" style="margin-top:10px;" onclick="state.screen='game'; saveState();">MASAYI KUR</button>
            </div>
            
            <div class="card">
                <h3>Kendi Telefonumdaki Arşiv</h3>
                ${arch.length === 0 ? '<p style="text-align:center; font-size:13px; color:#94a3b8;">Kayıt bulunamadı.</p>' : arch.reverse().map((a) => `
                    <div style="border:1px solid #e2e8f0; padding:10px; margin-bottom:10px; border-radius:8px; font-size:13px; background:#f8fafc;">
                        <strong style="color:var(--primary); display:block; margin-bottom:5px;">${a.date} - ${a.mode === 'team' ? 'Eşli' : 'Tekli'}</strong>
                        ${a.mode==='team' ? `Takım A: ${a.totals[0]+a.totals[1]} | Takım B: ${a.totals[2]+a.totals[3]}` : a.totals.join(' | ')}
                    </div>
                `).join('')}
            </div>`;
        return;
    }

    // 2. OYUN EKRANI HAZIRLIKLARI
    let scoreboardHTML = state.mode === 'team' ? `
        <div class="score-box bg-team-a" style="grid-column: span 2;"><h4>Takım A</h4><div class="total">${state.totals[0]+state.totals[1]}</div></div>
        <div class="score-box bg-team-b" style="grid-column: span 2;"><h4>Takım B</h4><div class="total">${state.totals[2]+state.totals[3]}</div></div>
    ` : state.players.map((p, i) => `<div class="score-box"><h4>${p}</h4><div class="total">${state.totals[i]}</div></div>`).join('');

    app.innerHTML = `
        <div class="card">
            <h2 style="margin-bottom:15px;">El Girişi</h2>
            <div class="players-grid">
                ${[0,1,2,3].map(i => `
                    <div class="player-card ${state.mode==='team'?(i<2?'border-team-a':'border-team-b'):''}">
                        <h4>${state.players[i]}</h4>
                        
                        <div class="toggle-row">
                            <button class="btn-toggle ${state.currentRound[`p${i}`].opened ? 'active' : ''}" style="flex:1;" onclick="toggleState(${i}, 'opened')">Açtı</button>
                            <button class="btn-toggle ${state.currentRound[`p${i}`].double ? 'active' : ''}" style="flex:1;" onclick="toggleState(${i}, 'double')">Çift</button>
                        </div>

                        <input type="number" id="score-input-${i}" placeholder="Eldeki Sayı" value="${state.currentRound[`p${i}`].score}" ${!state.currentRound[`p${i}`].opened?'disabled':''} onchange="handleScoreInput(${i}, this.value)">
                        
                        <div class="penalty-actions">
                            <button class="btn-danger btn-small" onclick="addPenalty(${i}, 101, '+101 Ceza')">+101</button>
                            <button class="btn-outline btn-small" onclick="askCustomPenalty(${i})">Ceza</button>
                        </div>
                    </div>`).join('')}
            </div>
        </div>

        <div class="card" style="border: 2px dashed var(--primary); background: #f8fafc;">
            <h3>Eli Bitir (Otomatik Hesaplanır)</h3>
            
            <p style="font-size:12px; color:#64748b; margin-bottom:8px; text-align:center;">Kim Bitti?</p>
            <div class="winner-cols">
                <div class="winner-col">
                    <button id="win-btn-0" class="btn-select btn-winner ${state.currentRound.winner == '0' ? 'active' : ''}" onclick="setWinner('0')">${state.players[0]}</button>
                    <button id="win-btn-1" class="btn-select btn-winner ${state.currentRound.winner == '1' ? 'active' : ''}" onclick="setWinner('1')">${state.players[1]}</button>
                </div>
                <div class="winner-col">
                    <button id="win-btn-2" class="btn-select btn-winner ${state.currentRound.winner == '2' ? 'active' : ''}" onclick="setWinner('2')">${state.players[2]}</button>
                    <button id="win-btn-3" class="btn-select btn-winner ${state.currentRound.winner == '3' ? 'active' : ''}" onclick="setWinner('3')">${state.players[3]}</button>
                </div>
            </div>
            <button id="win-btn--1" class="btn-select btn-winner ${state.currentRound.winner == '-1' ? 'active' : ''}" style="width:100%; margin-top:5px; background: #e2e8f0; font-weight:bold;" onclick="setWinner('-1')">BİTEN YOK</button>

            <div id="win-type-group" style="${state.currentRound.winner === '-1' ? 'opacity:0.4; pointer-events:none;' : ''}">
                <p style="font-size:12px; color:#64748b; margin-bottom:8px; text-align:center; margin-top:15px;">Nasıl Bitti?</p>
                <button id="type-btn-normal" class="btn-select btn-type ${state.currentRound.winType == 'normal' ? 'active' : ''}" style="width:100%; margin-bottom:10px;" onclick="setWinType('normal')">Normal</button>
                <div class="win-type-bottom">
                    <button id="type-btn-joker" class="btn-select btn-type ${state.currentRound.winType == 'joker' ? 'active' : ''}" onclick="setWinType('joker')">Joker</button>
                    <button id="type-btn-elden" class="btn-select btn-type ${state.currentRound.winType == 'elden' ? 'active' : ''}" onclick="setWinType('elden')">Elden</button>
                    <button id="type-btn-elden_joker" class="btn-select btn-type ${state.currentRound.winType == 'elden_joker' ? 'active' : ''}" onclick="setWinType('elden_joker')">Elden+Jkr</button>
                </div>
            </div>
        </div>

        <div class="card" style="margin-bottom:30px;">
            <h3>Bu Maçın Geçmişi</h3>
            <div style="overflow-x:auto;">
                <table class="history-table">
                    <thead><tr><th>El</th>${state.players.map(p=>`<th>${p.substring(0,4)}</th>`).join('')}</tr></thead>
                    <tbody>${(state.history || []).slice().reverse().map(h=> h.type==='round' ? `
                        <tr>
                            <td><strong>${h.roundNum}</strong><span class="history-detail">${h.details}</span></td>
                            ${h.scores.map(s=>`<td>${s}</td>`).join('')}
                        </tr>` : `
                        <tr style="background:#fee2e2"><td colspan="5" style="text-align:left; padding-left:10px;">${state.players[h.playerIdx]}: ${h.amount} (${h.reason})</td></tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn-danger" style="margin-top: 15px;" onclick="finishAndArchive()">MAÇI SIFIRLA VE ARŞİVE AL</button>
        </div>
        
        <div id="score-drawer" class="bottom-drawer ${state.showScoreboard ? 'open' : ''}">
            <button class="drawer-toggle" onclick="toggleScoreboard()">
                SKORLAR ${state.showScoreboard ? '▼' : '▲'}
            </button>
            <div class="scoreboard ${state.mode==='team'?'team-mode':''}">
                ${scoreboardHTML}
            </div>
        </div>
    `;
};
