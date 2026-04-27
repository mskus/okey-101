// === FIREBASE BAĞLANTISI ===
const firebaseConfig = { databaseURL: "https://okey-ef015-default-rtdb.europe-west1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const gameRef = db.ref('canliMasa'); 

// === UYGULAMA VE UI DURUMU ===
function getInitialRound() {
    return {
        p0: { opened: false, double: false, score: "" }, p1: { opened: false, double: false, score: "" },
        p2: { opened: false, double: false, score: "" }, p3: { opened: false, double: false, score: "" },
        winner: "-1", winType: "normal"
    };
}

let state = {
    screen: 'setup', mode: 'single',
    players: ["", "", "", ""], // Default Boş!
    totals: [0, 0, 0, 0], history: [], currentRound: getInitialRound()
};

let uiState = { showScoreboard: false, showCalc: false, calcValue: "" };
let isDataLoaded = false;

gameRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) state = data;
    isDataLoaded = true;
    render();
});

function saveState() {
    if (isDataLoaded) gameRef.set(state);
}

function getPlayerName(idx) {
    return state.players[idx] && state.players[idx].trim() !== "" ? state.players[idx] : `Oyuncu ${idx+1}`;
}

// === AKSİYON FONKSİYONLARI ===
window.handleScoreInput = function(idx, value) {
    state.currentRound[`p${idx}`].score = value;
    saveState();
};

window.toggleState = function(idx, field) {
    state.currentRound[`p${idx}`][field] = !state.currentRound[`p${idx}`][field];
    if (field === 'double' && state.currentRound[`p${idx}`].double) {
        state.currentRound[`p${idx}`].opened = true;
    }
    saveState();
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

// === HESAP MAKİNESİ VE ÇEKMECE KONTROLLERİ ===
window.toggleScoreboard = function() {
    uiState.showScoreboard = !uiState.showScoreboard;
    if(uiState.showScoreboard) uiState.showCalc = false; 
    updateDrawers();
};

window.toggleCalc = function() {
    uiState.showCalc = !uiState.showCalc;
    if(uiState.showCalc) uiState.showScoreboard = false; 
    updateDrawers();
};

function updateDrawers() {
    document.getElementById('score-drawer').classList.toggle('open', uiState.showScoreboard);
    document.getElementById('calc-drawer').classList.toggle('open', uiState.showCalc);
    document.getElementById('score-icon').innerText = uiState.showScoreboard ? '▼' : '▲';
    document.getElementById('calc-icon').innerText = uiState.showCalc ? '▼' : '▲';
}

window.calcPress = function(val) { uiState.calcValue += val; document.getElementById('calc-display').value = uiState.calcValue; };
window.calcClear = function() { uiState.calcValue = ""; document.getElementById('calc-display').value = uiState.calcValue; };
window.calcEval = function() {
    try { uiState.calcValue = eval(uiState.calcValue).toString(); document.getElementById('calc-display').value = uiState.calcValue; } 
    catch(e) { document.getElementById('calc-display').value = "Hata"; uiState.calcValue = ""; }
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
    
    // Kazanana takım rengini verme
    let pColor = state.mode === 'team' ? ((winnerIdx==0 || winnerIdx==1)?'text-team-a':'text-team-b') : '';
    let detailText = winnerIdx === -1 ? "Kimse Bitemedi" : `<span class="${pColor}">${getPlayerName(winnerIdx)}</span> (${typeLabels[winType]})`;

    if (!state.history) state.history = [];
    state.history.push({ 
        type: 'round', roundNum: state.history.filter(h => h.type === 'round').length + 1, 
        scores: roundScores, details: detailText, winnerIdx: winnerIdx 
    });
    
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
    let amt = prompt(`${getPlayerName(idx)} için özel ceza puanı (Örn: 50):`);
    if (amt && !isNaN(amt)) addPenalty(idx, parseInt(amt), 'Ceza');
};

window.finishAndArchive = function() {
    if(!confirm('Oyun sıfırlanacak, emin misiniz? (Yerel arşive kaydedilir)')) return;
    let arch = JSON.parse(localStorage.getItem('okey101Archives')) || [];
    arch.push({ date: new Date().toLocaleString('tr-TR'), mode: state.mode, players: state.players, totals: state.totals, history: state.history });
    localStorage.setItem('okey101Archives', JSON.stringify(arch));
    
    state = { screen: 'setup', mode: 'single', players: ["", "", "", ""], totals: [0, 0, 0, 0], history: [], currentRound: getInitialRound() };
    saveState();
};

function getStats(pIdx1, pIdx2 = -1) {
    let wins = 0; let pens = 0;
    (state.history || []).forEach(h => {
        if(h.type === 'round' && (h.winnerIdx == pIdx1 || h.winnerIdx == pIdx2)) wins++;
        if(h.type === 'penalty' && (h.playerIdx == pIdx1 || h.playerIdx == pIdx2) && h.amount > 0) pens += h.amount;
    });
    return { wins, pens };
}

// === RENDER EKRANI ===
window.render = function() {
    const app = document.getElementById('app');
    
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
                <h3>Geçmiş Maçlar Arşiv</h3>
                ${arch.length === 0 ? '<p style="text-align:center; font-size:13px; color:#94a3b8;">Kayıt bulunamadı.</p>' : arch.reverse().map((a) => {
                    let isTeam = a.mode === 'team';
                    let tA = a.totals[0] + a.totals[1];
                    let tB = a.totals[2] + a.totals[3];
                    let winnerText = "";
                    
                    if(isTeam) {
                        if(tA < tB) winnerText = `<span class="text-team-a">🏆 Takım A</span>`;
                        else if(tB < tA) winnerText = `<span class="text-team-b">🏆 Takım B</span>`;
                        else winnerText = "🤝 Berabere";
                    } else {
                        let min = Math.min(...a.totals);
                        let wIdx = a.totals.indexOf(min);
                        winnerText = `🏆 ${a.players[wIdx]}`;
                    }
                    
                    return `
                    <div style="border:1px solid #e2e8f0; padding:10px; margin-bottom:10px; border-radius:8px; font-size:13px; background:#f8fafc;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">
                            <strong style="color:var(--primary);">${a.date} - ${isTeam ? 'Eşli' : 'Tekli'}</strong>
                            ${winnerText}
                        </div>
                        ${isTeam ? `<span class="${tA < tB ? 'text-team-a' : ''}">Takım A: ${tA}</span> | <span class="${tB < tA ? 'text-team-b' : ''}">Takım B: ${tB}</span>` : a.totals.join(' | ')}
                    </div>`
                }).join('')}
            </div>`;
        return;
    }

    // Skor Tablosu HTML - Çok Daha Detaylı
    let scoreboardHTML = "";
    if(state.mode === 'team') {
        let sA = getStats(0, 1); let sB = getStats(2, 3);
        scoreboardHTML = `
            <div class="score-box bg-team-a" style="grid-column: span 2;">
                <h4>Takım A</h4><div class="total">${state.totals[0]+state.totals[1]}</div>
                <div class="stat-detail" style="border-top:1px solid rgba(255,255,255,0.3); padding-top:8px; margin-top:8px;">
                    ${getPlayerName(0).substring(0,8)}: <strong>${state.totals[0]}</strong> | ${getPlayerName(1).substring(0,8)}: <strong>${state.totals[1]}</strong><br>
                    Biten El: ${sA.wins} | Yenen Ceza: ${sA.pens}
                </div>
            </div>
            <div class="score-box bg-team-b" style="grid-column: span 2;">
                <h4>Takım B</h4><div class="total">${state.totals[2]+state.totals[3]}</div>
                <div class="stat-detail" style="border-top:1px solid rgba(255,255,255,0.3); padding-top:8px; margin-top:8px;">
                    ${getPlayerName(2).substring(0,8)}: <strong>${state.totals[2]}</strong> | ${getPlayerName(3).substring(0,8)}: <strong>${state.totals[3]}</strong><br>
                    Biten El: ${sB.wins} | Yenen Ceza: ${sB.pens}
                </div>
            </div>`;
    } else {
        scoreboardHTML = [0,1,2,3].map(i => {
            let s = getStats(i);
            return `<div class="score-box">
                <h4>${getPlayerName(i).substring(0,8)}</h4><div class="total">${state.totals[i]}</div>
                <div class="stat-detail" style="border-top:1px solid #cbd5e1; padding-top:8px; margin-top:8px;">Biten: ${s.wins} | Cz: ${s.pens}</div>
            </div>`;
        }).join('');
    }

    let btnA = state.mode === 'team' ? 'bg-team-a-light text-team-a' : '';
    let btnB = state.mode === 'team' ? 'bg-team-b-light text-team-b' : '';

    app.innerHTML = `
        <div class="card">
            <div class="players-grid">
                ${[0,1,2,3].map(i => `
                    <div class="player-card ${state.mode==='team'?(i<2?'border-team-a':'border-team-b'):''}">
                        <h4 class="${state.mode==='team'?(i<2?'text-team-a':'text-team-b'):''}">${getPlayerName(i).substring(0,12)}</h4>
                        <div class="toggle-row">
                            <button class="btn-toggle ${state.currentRound[`p${i}`].opened ? 'active' : ''}" style="flex:1;" onclick="toggleState(${i}, 'opened')">Açtı</button>
                            <button class="btn-toggle ${state.currentRound[`p${i}`].double ? 'active' : ''}" style="flex:1;" onclick="toggleState(${i}, 'double')">Çift</button>
                        </div>
                        <input type="number" id="score-input-${i}" placeholder="Eldeki Sayı" value="${state.currentRound[`p${i}`].score}" ${!state.currentRound[`p${i}`].opened?'disabled':''} onchange="handleScoreInput(${i}, this.value)">
                        <div class="penalty-actions">
                            <button class="btn-danger btn-small" onclick="addPenalty(${i}, 101, '+101')">+101</button>
                            <button class="btn-outline btn-small" onclick="askCustomPenalty(${i})">Ceza</button>
                        </div>
                    </div>`).join('')}
            </div>
        </div>

        <div class="card" style="border: 2px dashed var(--primary); background: #f8fafc;">
            <h3>Eli Bitir</h3>
            <p style="font-size:12px; color:#64748b; margin-bottom:8px; text-align:center;">Kim Bitti?</p>
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
                    <thead><tr><th>El</th>${[0,1,2,3].map(i=>`<th>${getPlayerName(i).substring(0,6)}</th>`).join('')}</tr></thead>
                    <tbody>${(state.history || []).slice().reverse().map(h=> {
                        if(h.type === 'round') {
                            let rowClass = (state.mode === 'team' && h.winnerIdx !== "-1") ? ((h.winnerIdx == 0 || h.winnerIdx == 1) ? 'history-team-a' : 'history-team-b') : '';
                            return `
                            <tr class="${rowClass}">
                                <td><strong>${h.roundNum}</strong><span class="history-detail">${h.details}</span></td>
                                ${h.scores.map(s=>`<td>${s}</td>`).join('')}
                            </tr>`;
                        } else {
                            let pClass = state.mode === 'team' ? ((h.playerIdx == 0 || h.playerIdx == 1) ? 'text-team-a' : 'text-team-b') : '';
                            return `
                            <tr style="background:#fee2e2"><td colspan="5" style="text-align:left; padding-left:10px;"><strong class="${pClass}">${getPlayerName(h.playerIdx)}</strong>: ${h.amount} (${h.reason})</td></tr>`;
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
                    <button class="calc-btn" onclick="calcPress('4')">4</button><button class="calc-btn" onclick="calcPress('5')">5</button><button class="calc-btn" onclick="calcPress('6')">6</button><button class="calc-btn calc-btn-op" onclick="calcPress('*')">x</button>
                    <button class="calc-btn" onclick="calcPress('1')">1</button><button class="calc-btn" onclick="calcPress('2')">2</button><button class="calc-btn" onclick="calcPress('3')">3</button><button class="calc-btn calc-btn-op" onclick="calcPress('-')">-</button>
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
    `;
    updateDrawers(); 
};
