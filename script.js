// --- STATE MANAGEMENT (Tüm verilerin tutulduğu obje) ---
let state = JSON.parse(localStorage.getItem('okey101State')) || {
    screen: 'setup', // 'setup' veya 'game'
    players: ["Oyuncu 1", "Oyuncu 2", "Oyuncu 3", "Oyuncu 4"],
    totals: [0, 0, 0, 0],
    history: [], // Oynanan eller ve anlık cezalar burada tutulur
    currentRound: {
        p0: { opened: true, double: false, score: "" },
        p1: { opened: true, double: false, score: "" },
        p2: { opened: true, double: false, score: "" },
        p3: { opened: true, double: false, score: "" },
        winner: "-1",
        winType: "normal" // normal, elden, joker, elden_joker
    }
};

// --- CORE FUNCTIONS (Temel Fonksiyonlar) ---
function saveState() {
    localStorage.setItem('okey101State', JSON.stringify(state));
    render(); // Veri her değiştiğinde ekranı günceller
}

function updateDraft(playerIndex, field, value) {
    state.currentRound[`p${playerIndex}`][field] = value;
    saveState();
}

// --- KURALLAR VE HESAPLAMA MOTORU ---
window.calculateRound = function() {
    let winnerIdx = parseInt(state.currentRound.winner);
    let winType = state.currentRound.winType;
    let roundScores = [0, 0, 0, 0];
    let winnerWentDouble = winnerIdx >= 0 ? state.currentRound[`p${winnerIdx}`].double : false;

    for (let i = 0; i < 4; i++) {
        let p = state.currentRound[`p${i}`];
        
        // EĞER KAZANAN BU OYUNCUYSA
        if (i === winnerIdx) {
            if (winType === 'normal') roundScores[i] = -101;
            else if (winType === 'joker' || winType === 'elden') roundScores[i] = -202;
            else if (winType === 'elden_joker') roundScores[i] = -404;
            continue;
        }

        // KAZANAMAYAN OYUNCULAR
        let basePenalty = 0;
        if (!p.opened) {
            basePenalty = 202; // El açmamışsa taban ceza 202
        } else {
            basePenalty = parseInt(p.score) || 0; // Açmışsa elindeki taş toplamı
        }

        // Çarpanları Hesapla
        let multiplier = 1;
        if (p.double) multiplier *= 2; // Kendi çifte gittiyse x2
        if (winnerWentDouble) multiplier *= 2; // Kazanan çifte gittiyse x2
        
        if (winType === 'joker' || winType === 'elden') multiplier *= 2; // Jokerle veya Elden bittiyse x2
        if (winType === 'elden_joker') multiplier *= 4; // Elden + Joker bittiyse x4

        roundScores[i] = basePenalty * multiplier;
    }

    // Toplamlara Ekle ve Geçmişe Yaz
    for (let i = 0; i < 4; i++) state.totals[i] += roundScores[i];
    
    state.history.push({
        type: 'round',
        roundNum: state.history.filter(h => h.type === 'round').length + 1,
        scores: roundScores,
        details: winnerIdx === -1 ? "Kimse Bitemedi" : `${state.players[winnerIdx]} Bitti (${winType})`
    });

    // Yeni ele geç (Masayı sıfırla)
    state.currentRound = {
        p0: { opened: true, double: false, score: "" }, p1: { opened: true, double: false, score: "" },
        p2: { opened: true, double: false, score: "" }, p3: { opened: true, double: false, score: "" },
        winner: "-1", winType: "normal"
    };
    saveState();
}

window.addPenalty = function(playerIndex, amount, reason) {
    state.totals[playerIndex] += amount;
    state.history.push({
        type: 'penalty',
        playerIdx: playerIndex,
        amount: amount,
        reason: reason
    });
    saveState();
}

// --- ARAYÜZ (UI) OLUŞTURUCU ---
window.render = function() {
    const app = document.getElementById('app');
    
    // 1. KURULUM EKRANI
    if (state.screen === 'setup') {
        app.innerHTML = `
            <div class="card">
                <h1>101 Okey Kurulumu</h1>
                <input type="text" id="p1" value="${state.players[0]}" onchange="state.players[0]=this.value; saveState();">
                <input type="text" id="p2" value="${state.players[1]}" onchange="state.players[1]=this.value; saveState();">
                <input type="text" id="p3" value="${state.players[2]}" onchange="state.players[2]=this.value; saveState();">
                <input type="text" id="p4" value="${state.players[3]}" onchange="state.players[3]=this.value; saveState();">
                <button class="btn-primary" onclick="state.screen='game'; saveState();">Oyuna Başla</button>
            </div>
        `;
        return;
    }

    // 2. OYUN EKRANI
    let gameHTML = `
        <div class="scoreboard">
            ${state.players.map((p, i) => `
                <div class="score-box">
                    <h4>${p}</h4>
                    <div class="total ${state.totals[i] < 0 ? 'row-penalty' : ''}" style="color:${state.totals[i] < 0 ? '#10b981' : 'var(--primary)'}">
                        ${state.totals[i]}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="card">
            <h2>El Hesaplayıcı (Masadaki Durum)</h2>
            <div class="players-grid">
                ${[0,1,2,3].map(i => {
                    let pData = state.currentRound[`p${i}`];
                    return `
                    <div class="player-card">
                        <h4>${state.players[i]}</h4>
                        <div class="checkbox-group">
                            <label>
                                <input type="checkbox" ${pData.opened ? 'checked' : ''} 
                                onchange="updateDraft(${i}, 'opened', this.checked)"> 
                                Elini Açtı
                            </label>
                            <label>
                                <input type="checkbox" ${pData.double ? 'checked' : ''} 
                                onchange="updateDraft(${i}, 'double', this.checked)"> 
                                Çifte Gitti
                            </label>
                        </div>
                        <input type="number" placeholder="Kalan Sayı" value="${pData.score}" 
                            ${!pData.opened ? 'disabled' : ''} 
                            oninput="updateDraft(${i}, 'score', this.value)">
                        
                        <div class="penalty-actions">
                            <button class="btn-danger" onclick="addPenalty(${i}, 101, 'Ceza (Yanlış/İşler vb.)')">+101 Ceza</button>
                            <button class="btn-warning" onclick="addPenalty(${i}, -101, 'Ceza Sil/Düzelt')">-101 Sil</button>
                        </div>
                    </div>
                    `
                }).join('')}
            </div>
        </div>

        <div class="card finish-area">
            <h2>Eli Bitir</h2>
            <select onchange="state.currentRound.winner = this.value; saveState();">
                <option value="-1" ${state.currentRound.winner == "-1" ? 'selected' : ''}>Masada Kimse Bitemedi (Taş Bitti)</option>
                ${state.players.map((p, i) => `
                    <option value="${i}" ${state.currentRound.winner == i ? 'selected' : ''}>${p} BİTİRDİ</option>
                `).join('')}
            </select>
            
            <select onchange="state.currentRound.winType = this.value; saveState();" ${state.currentRound.winner == "-1" ? 'disabled' : ''}>
                <option value="normal" ${state.currentRound.winType == "normal" ? 'selected' : ''}>Normal Bitti</option>
                <option value="joker" ${state.currentRound.winType == "joker" ? 'selected' : ''}>Joker Atarak Bitti (x2)</option>
                <option value="elden" ${state.currentRound.winType == "elden" ? 'selected' : ''}>Tek Elde Açtı / Elden Bitti (x2)</option>
                <option value="elden_joker" ${state.currentRound.winType == "elden_joker" ? 'selected' : ''}>Elden + Joker Bitti (x4)</option>
            </select>

            <button class="btn-success" onclick="calculateRound()">Eli Hesapla ve Tabloya Ekle</button>
        </div>

        <div class="card">
            <h2>Oyun Geçmişi</h2>
            <div style="overflow-x: auto;">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Detay</th>
                            ${state.players.map(p => `<th>${p.substring(0,5)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${state.history.slice().reverse().map(h => {
                            if (h.type === 'round') {
                                return `<tr>
                                    <td><strong>El ${h.roundNum}</strong><br><span style="font-size:10px">${h.details}</span></td>
                                    ${h.scores.map(s => `<td>${s}</td>`).join('')}
                                </tr>`;
                            } else {
                                return `<tr style="background:#fee2e2">
                                    <td colspan="5" style="text-align:left; padding-left:10px;">
                                        <strong style="color:var(--danger)">Hızlı Ceza:</strong> ${state.players[h.playerIdx]} -> ${h.amount > 0 ? '+'+h.amount : h.amount} (${h.reason})
                                    </td>
                                </tr>`;
                            }
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <button class="btn-danger" style="margin-top:15px;" onclick="if(confirm('Tüm oyun silinecek, emin misin?')){ localStorage.removeItem('okey101State'); location.reload(); }">Oyunu Sıfırla (Yeni Maç)</button>
        </div>
    `;
    app.innerHTML = gameHTML;
}

// Uygulamayı Başlat
render();
