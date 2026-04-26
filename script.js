// --- STATE MANAGEMENT ---
function getInitialRound() {
    return {
        p0: { opened: false, double: false, score: "" }, p1: { opened: false, double: false, score: "" },
        p2: { opened: false, double: false, score: "" }, p3: { opened: false, double: false, score: "" },
        winner: "-1", winType: "normal"
    };
}

let state = JSON.parse(localStorage.getItem('okey101State')) || {
    screen: 'setup', mode: 'single', hideScores: false,
    players: ["1. Oyuncu", "2. Oyuncu", "3. Oyuncu", "4. Oyuncu"],
    totals: [0, 0, 0, 0],
    history: [],
    currentRound: getInitialRound()
};

function saveState(shouldRender = true) {
    localStorage.setItem('okey101State', JSON.stringify(state));
    if(shouldRender) render();
}

// KLAVYE KAPANMAMASI İÇİN DOM MANİPÜLASYONU
window.handleScoreInput = function(playerIndex, value) {
    state.currentRound[`p${playerIndex}`].score = value;
    localStorage.setItem('okey101State', JSON.stringify(state));
};

window.handleCheckbox = function(playerIndex, field, isChecked) {
    state.currentRound[`p${playerIndex}`][field] = isChecked;
    localStorage.setItem('okey101State', JSON.stringify(state));
    if (field === 'opened') {
        const input = document.getElementById(`score-input-${playerIndex}`);
        if (input) input.disabled = !isChecked;
    }
};

// HESAPLAMA MOTORU
window.calculateRound = function() {
    let winnerIdx = parseInt(state.currentRound.winner);
    let winType = state.currentRound.winType;
    let roundScores = [0, 0, 0, 0];
    let winnerWentDouble = winnerIdx >= 0 ? state.currentRound[`p${winnerIdx}`].double : false;

    // YENİ EŞLEŞME: 1-2 (Takım A) / 3-4 (Takım B)
    let partnerIdx = -1;
    if (winnerIdx === 0) partnerIdx = 1;
    else if (winnerIdx === 1) partnerIdx = 0;
    else if (winnerIdx === 2) partnerIdx = 3;
    else if (winnerIdx === 3) partnerIdx = 2;

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
    state.history.push({
        type: 'round', roundNum: state.history.filter(h => h.type === 'round').length + 1,
        scores: roundScores, details: winnerIdx === -1 ? "Biten Yok" : `${state.players[winnerIdx]} Bitti`
    });
    state.currentRound = getInitialRound();
    saveState();
};

window.addPenalty = function(idx, amt, reason) {
    state.totals[idx] += amt;
    state.history.push({ type: 'penalty', playerIdx: idx, amount: amt, reason: reason });
    saveState();
};

window.askCustomPenalty = function(idx) {
    let amt = prompt(`Puan girin (Ceza için pozitif, silmek için negatif):`);
    if (amt && !isNaN(amt)) addPenalty(idx, parseInt(amt), 'Özel');
};

window.finishAndArchive = function() {
    if(!confirm('Maç kaydedilsin mi?')) return;
    let arch = JSON.parse(localStorage.getItem('okey101Archives')) || [];
    arch.push({
        date: new Date().toLocaleString('tr-TR'),
        mode: state.mode, players: state.players, totals: state.totals, history: state.history
    });
    localStorage.setItem('okey101Archives', JSON.stringify(arch));
    localStorage.removeItem('okey101State');
    location.reload();
};

// RENDER
window.render = function() {
    const app = document.getElementById('app');
    
    if (state.screen === 'setup') {
        let arch = JSON.parse(localStorage.getItem('okey101Archives')) || [];
        app.innerHTML = `
            <div class="card">
                <h1>101 Okey Takip</h1>
                <div class="mode-selector">
                    <button class="${state.mode === 'single' ? 'btn-primary' : 'btn-outline'}" onclick="state.mode='single'; saveState();">Tekli</button>
                    <button class="${state.mode === 'team' ? 'btn-primary' : 'btn-outline'}" onclick="state.mode='team'; saveState();">Eşli (1-2 / 3-4)</button>
                </div>
                ${state.players.map((p, i) => `
                    <input type="text" class="${state.mode === 'team' ? (i<2 ? 'border-team-a':'border-team-b') : ''}" 
                    value="${p}" onchange="state.players[${i}]=this.value; saveState(false);">
                `).join('')}
                <button class="btn-success" onclick="state.screen='game'; saveState();">BAŞLAT</button>
            </div>
            <div class="card">
                <h3>Geçmiş Maçlar (Detay için tıkla)</h3>
                ${arch.reverse().map((a, idx) => `
                    <div class="archive-card" onclick="this.classList.toggle('active')">
                        <span class="archive-date">${a.date} - ${a.mode === 'team' ? 'Eşli' : 'Tekli'}</span>
                        <div><strong>Sonuç:</strong> ${a.mode==='team' ? `A: ${a.totals[0]+a.totals[1]} | B: ${a.totals[2]+a.totals[3]}` : a.totals.join(' | ')}</div>
                        <div class="archive-details">
                            <table class="history-table">
                                <thead><tr><th>El</th>${a.players.map(p=>`<th>${p.substring(0,3)}</th>`).join('')}</tr></thead>
                                <tbody>${a.history.filter(h=>h.type==='round').map(h=>`<tr><td>${h.roundNum}</td>${h.scores.map(s=>`<td>${s}</td>`).join('')}</tr>`).join('')}</tbody>
                            </table>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        return;
    }

    let scoreboardHTML = state.mode === 'team' ? `
        <div class="score-box bg-team-a"><h4>Takım A</h4><div class="${state.hideScores?'hidden-score':'total'}">${state.hideScores?'***':(state.totals[0]+state.totals[1])}</div></div>
        <div class="score-box bg-team-b"><h4>Takım B</h4><div class="${state.hideScores?'hidden-score':'total'}">${state.hideScores?'***':(state.totals[2]+state.totals[3])}</div></div>
    ` : state.players.map((p, i) => `<div class="score-box"><h4>${p}</h4><div class="${state.hideScores?'hidden-score':'total'}">${state.hideScores?'***':state.totals[i]}</div></div>`).join('');

    app.innerHTML = `
        <div class="scoreboard ${state.mode==='team'?'team-mode':''}">
            ${scoreboardHTML}
        </div>
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h2 style="margin:0">El Girişi</h2>
                <button class="btn-outline btn-small" style="width:auto" onclick="state.hideScores=!state.hideScores; saveState();">${state.hideScores?'Göster':'Gizle'}</button>
            </div>
            <div class="players-grid">
                ${[0,1,2,3].map(i => `
                    <div class="player-card ${state.mode==='team'?(i<2?'border-team-a':'border-team-b'):''}">
                        <h4>${state.players[i]}</h4>
                        <div class="checkbox-group">
                            <label><input type="checkbox" ${state.currentRound[`p${i}`].opened?'checked':''} onchange="handleCheckbox(${i}, 'opened', this.checked)"> Açtı</label>
                            <label><input type="checkbox" ${state.currentRound[`p${i}`].double?'checked':''} onchange="handleCheckbox(${i}, 'double', this.checked)"> Çift</label>
                        </div>
                        <input type="number" id="score-input-${i}" placeholder="Sayı" value="${state.currentRound[`p${i}`].score}" ${!state.currentRound[`p${i}`].opened?'disabled':''} oninput="handleScoreInput(${i}, this.value)">
                        <div class="penalty-actions">
                            <button class="btn-danger btn-small" onclick="addPenalty(${i}, 101, 'Ceza')">+101</button>
                            <button class="btn-outline btn-small" onclick="askCustomPenalty(${i})">Özel</button>
                        </div>
                    </div>`).join('')}
            </div>
        </div>
        <div class="card" style="background:#eef2ff; border:2px dashed var(--primary)">
            <h3>Eli Bitir</h3>
            <select onchange="state.currentRound.winner=this.value; saveState(false);">
                <option value="-1">Biten Yok</option>
                ${state.players.map((p,i)=>`<option value="${i}" ${state.currentRound.winner==i?'selected':''}>${p} BİTTİ</option>`).join('')}
            </select>
            <select onchange="state.currentRound.winType=this.value; saveState(false);">
                <option value="normal">Normal</option><option value="joker">Joker (x2)</option><option value="elden">Elden (x2)</option><option value="elden_joker">Elden+Joker (x4)</option>
            </select>
            <button class="btn-success" onclick="calculateRound()">HESAPLA</button>
        </div>
        <div class="card">
            <h3>Bu Maçın Geçmişi</h3>
            <table class="history-table">
                <thead><tr><th>El</th>${state.players.map(p=>`<th>${p.substring(0,3)}</th>`).join('')}</tr></thead>
                <tbody>${state.history.slice().reverse().map(h=> h.type==='round' ? `<tr><td>${h.roundNum}</td>${h.scores.map(s=>`<td>${s}</td>`).join('')}</tr>` : `<tr style="background:#fff1f2"><td colspan="5">Ceza: ${state.players[h.playerIdx]} (${h.amount})</td></tr>`).join('')}</tbody>
            </table>
        </div>
        <button class="btn-danger" onclick="finishAndArchive()">MAÇI BİTİR VE KAYDET</button>
    `;
};
render();
