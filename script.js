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

// HIZLI SEÇİM BUTONLARI İÇİN FONKSİYONLAR (Sayfayı yenilemez, sadece stilleri değiştirir)
window.setWinner = function(val) {
    state.currentRound.winner = val;
    saveState(false);
    document.querySelectorAll('.btn-winner').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`win-btn-${val}`).classList.add('active');
    
    // Eğer kimse bitemediyse Bitiş türü butonlarını pasifleştir
    const typeGroup = document.getElementById('win-type-group');
    if(typeGroup) typeGroup.style.opacity = val === "-1" ? "0.5" : "1";
    if(typeGroup) typeGroup.style.pointerEvents = val === "-1" ? "none" : "auto";
};

window.setWinType = function(val) {
    state.currentRound.winType = val;
    saveState(false);
    document.querySelectorAll('.btn-type').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`type-btn-${val}`).classList.add('active');
};

// HESAPLAMA MOTORU
window.calculateRound = function() {
    let winnerIdx = parseInt(state.currentRound.winner);
    let winType = state.currentRound.winType;
    let roundScores = [0, 0, 0, 0];
    let winnerWentDouble = winnerIdx >= 0 ? state.currentRound[`p${winnerIdx}`].double : false;

    // Eşleşme: 1-2 (Takım A) / 3-4 (Takım B)
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
    
    // Geçmiş Detayı Hazırlama
    let typeLabels = { "normal": "Normal", "joker": "Joker", "elden": "Elden", "elden_joker": "Elden+Joker" };
    let detailText = winnerIdx === -1 ? "Kimse Bitemedi" : `${state.players[winnerIdx]} (${typeLabels[winType]})`;

    state.history.push({
        type: 'round', roundNum: state.history.filter(h => h.type === 'round').length + 1,
        scores: roundScores, details: detailText
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
    let amt = prompt(`${state.players[idx]} için eklenecek puan: (Ceza için 50, Silmek için -50 gibi)`);
    if (amt && !isNaN(amt)) addPenalty(idx, parseInt(amt), 'Özel Puan');
};

window.finishAndArchive = function() {
    if(!confirm('Maçı bitirip kaydetmek istediğinize emin misiniz?')) return;
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
                <div class="fast-select-group" style="margin-bottom:15px;">
                    <button class="${state.mode === 'single' ? 'active' : ''}" onclick="state.mode='single'; saveState();">Tekli Oyun</button>
                    <button class="${state.mode === 'team' ? 'active' : ''}" onclick="state.mode='team'; saveState();">Eşli Oyun (1-2 / 3-4)</button>
                </div>
                ${state.players.map((p, i) => `
                    <input type="text" value="${p}" onchange="state.players[${i}]=this.value; saveState(false);" placeholder="${i+1}. Oyuncu İsmi">
                `).join('')}
                <button class="btn-success" onclick="state.screen='game'; saveState();">Oyunu Başlat</button>
            </div>
            <div class="card">
                <h3>Geçmiş Maç Arşivi</h3>
                ${arch.length === 0 ? '<p style="text-align:center; font-size:13px; color:#94a3b8;">Kayıt bulunamadı.</p>' : arch.reverse().map((a, idx) => `
                    <div style="border:1px solid #e2e8f0; padding:10px; margin-bottom:10px; border-radius:8px; font-size:13px; background:#f8fafc;">
                        <strong style="color:var(--primary); display:block; margin-bottom:5px;">${a.date} - ${a.mode === 'team' ? 'Eşli' : 'Tekli'}</strong>
                        ${a.mode==='team' ? `Takım A: ${a.totals[0]+a.totals[1]} | Takım B: ${a.totals[2]+a.totals[3]}` : a.totals.join(' | ')}
                    </div>
                `).join('')}
            </div>`;
        return;
    }

    let scoreboardHTML = state.mode === 'team' ? `
        <div class="score-box bg-team-a" style="grid-column: span 2; border-radius:8px;"><h4>Takım A</h4><div class="${state.hideScores?'hidden-score':'total'}">${state.hideScores?'***':(state.totals[0]+state.totals[1])}</div></div>
        <div class="score-box bg-team-b" style="grid-column: span 2; border-radius:8px;"><h4>Takım B</h4><div class="${state.hideScores?'hidden-score':'total'}">${state.hideScores?'***':(state.totals[2]+state.totals[3])}</div></div>
    ` : state.players.map((p, i) => `<div class="score-box"><h4>${p}</h4><div class="${state.hideScores?'hidden-score':'total'}">${state.hideScores?'***':state.totals[i]}</div></div>`).join('');

    app.innerHTML = `
        <div class="scoreboard ${state.mode==='team'?'team-mode':''}">
            ${scoreboardHTML}
        </div>
        
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2 style="margin:0">El Girişi</h2>
                <button class="btn-outline btn-small" style="width:auto" onclick="state.hideScores=!state.hideScores; saveState();">${state.hideScores?'Skoru Göster':'Skoru Gizle'}</button>
            </div>
            
            <div class="players-grid">
                ${[0,1,2,3].map(i => `
                    <div class="player-card ${state.mode==='team'?(i<2?'border-team-a':'border-team-b'):''}">
                        <h4>${state.players[i]}</h4>
                        <div class="checkbox-group">
                            <label><input type="checkbox" ${state.currentRound[`p${i}`].opened?'checked':''} onchange="handleCheckbox(${i}, 'opened', this.checked)"> Elini Açtı</label>
                            <label><input type="checkbox" ${state.currentRound[`p${i}`].double?'checked':''} onchange="handleCheckbox(${i}, 'double', this.checked)"> Çifte Gitti</label>
                        </div>
                        <input type="number" id="score-input-${i}" placeholder="Eldeki Sayı" value="${state.currentRound[`p${i}`].score}" ${!state.currentRound[`p${i}`].opened?'disabled':''} oninput="handleScoreInput(${i}, this.value)">
                        <div class="penalty-actions">
                            <button class="btn-danger btn-small" onclick="addPenalty(${i}, 101, 'Ceza')">+101</button>
                            <button class="btn-outline btn-small" onclick="askCustomPenalty(${i})">Özel</button>
                        </div>
                    </div>`).join('')}
            </div>
        </div>

        <div class="card" style="border: 2px dashed var(--primary); background: #f8fafc;">
            <h3>Eli Bitir</h3>
            
            <p style="font-size:12px; color:#64748b; margin-bottom:5px;">Kim Bitti?</p>
            <div class="fast-select-group">
                <button id="win-btn--1" class="btn-winner ${state.currentRound.winner == '-1' ? 'active' : ''}" onclick="setWinner('-1')">Biten Yok</button>
                ${state.players.map((p,i)=>`<button id="win-btn-${i}" class="btn-winner ${state.currentRound.winner == i ? 'active' : ''}" onclick="setWinner('${i}')">${p.substring(0,6)}</button>`).join('')}
            </div>

            <div id="win-type-group" style="${state.currentRound.winner === '-1' ? 'opacity:0.5; pointer-events:none;' : ''}">
                <p style="font-size:12px; color:#64748b; margin-bottom:5px;">Nasıl Bitti?</p>
                <div class="fast-select-group">
                    <button id="type-btn-normal" class="btn-type ${state.currentRound.winType == 'normal' ? 'active' : ''}" onclick="setWinType('normal')">Normal</button>
                    <button id="type-btn-joker" class="btn-type ${state.currentRound.winType == 'joker' ? 'active' : ''}" onclick="setWinType('joker')">Joker</button>
                    <button id="type-btn-elden" class="btn-type ${state.currentRound.winType == 'elden' ? 'active' : ''}" onclick="setWinType('elden')">Elden</button>
                    <button id="type-btn-elden_joker" class="btn-type ${state.currentRound.winType == 'elden_joker' ? 'active' : ''}" onclick="setWinType('elden_joker')">Elden+Joker</button>
                </div>
            </div>

            <button class="btn-success" style="margin-top:10px;" onclick="calculateRound()">Hesapla ve Tabloya Ekle</button>
        </div>

        <div class="card">
            <h3>Bu Maçın Geçmişi</h3>
            <div style="overflow-x:auto;">
                <table class="history-table">
                    <thead><tr><th>El</th>${state.players.map(p=>`<th>${p.substring(0,4)}</th>`).join('')}</tr></thead>
                    <tbody>${state.history.slice().reverse().map(h=> h.type==='round' ? `
                        <tr>
                            <td><strong>${h.roundNum}</strong><span class="history-detail">${h.details}</span></td>
                            ${h.scores.map(s=>`<td>${s}</td>`).join('')}
                        </tr>` : `
                        <tr style="background:#fee2e2"><td colspan="5" style="text-align:left; padding-left:10px;">${state.players[h.playerIdx]}: ${h.amount} (${h.reason})</td></tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        <button class="btn-danger" onclick="finishAndArchive()">MAÇI BİTİR VE KAYDET</button>
    `;
};

render();
