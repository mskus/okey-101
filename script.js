// --- STATE MANAGEMENT ---
function getInitialRound() {
    return {
        // "Elini Açtı" varsayılan olarak kapalı (false)
        p0: { opened: false, double: false, score: "" }, p1: { opened: false, double: false, score: "" },
        p2: { opened: false, double: false, score: "" }, p3: { opened: false, double: false, score: "" },
        winner: "-1", winType: "normal"
    };
}

let state = JSON.parse(localStorage.getItem('okey101State')) || {
    screen: 'setup', 
    mode: 'single', // 'single' veya 'team'
    hideScores: false, // Skor gizleme durumu
    players: ["1. Oyuncu", "2. Oyuncu", "3. Oyuncu", "4. Oyuncu"],
    totals: [0, 0, 0, 0],
    history: [],
    currentRound: getInitialRound()
};

function saveState(shouldRender = true) {
    localStorage.setItem('okey101State', JSON.stringify(state));
    if(shouldRender) render();
}

// KLAVYE KAPANMAMASI İÇİN SADECE STATE GÜNCELLENİR, RENDER EDİLMEZ
window.handleScoreInput = function(playerIndex, value) {
    state.currentRound[`p${playerIndex}`].score = value;
    localStorage.setItem('okey101State', JSON.stringify(state));
};

// CHECKBOX DEĞİŞİKLİKLERİ (Sadece ilgili input'u aktif/pasif yapar, render etmez)
window.handleCheckbox = function(playerIndex, field, isChecked) {
    state.currentRound[`p${playerIndex}`][field] = isChecked;
    localStorage.setItem('okey101State', JSON.stringify(state));
    
    if (field === 'opened') {
        const scoreInput = document.getElementById(`score-input-${playerIndex}`);
        if (scoreInput) scoreInput.disabled = !isChecked;
    }
};

window.askCustomPenalty = function(playerIndex) {
    let amount = prompt(`${state.players[playerIndex]} için eklenecek veya silinecek Puanı girin:\n(Örn: Ceza için 50, Silmek için -50 yazın)`);
    if (amount && !isNaN(amount)) {
        addPenalty(playerIndex, parseInt(amount), 'Özel Puan');
    }
};

// --- KURALLAR VE HESAPLAMA MOTORU ---
window.calculateRound = function() {
    let winnerIdx = parseInt(state.currentRound.winner);
    let winType = state.currentRound.winType;
    let roundScores = [0, 0, 0, 0];
    let winnerWentDouble = winnerIdx >= 0 ? state.currentRound[`p${winnerIdx}`].double : false;

    // Eşli Mod kontrolü (Takım arkadaşının indexi: (kendi indexi + 2) % 4)
    let partnerIdx = winnerIdx >= 0 ? (winnerIdx + 2) % 4 : -1;

    for (let i = 0; i < 4; i++) {
        let p = state.currentRound[`p${i}`];
        
        // EĞER KAZANAN BU OYUNCUYSA
        if (i === winnerIdx) {
            if (winType === 'normal') roundScores[i] = -101;
            else if (winType === 'joker' || winType === 'elden') roundScores[i] = -202;
            else if (winType === 'elden_joker') roundScores[i] = -404;
            continue;
        }

        // EŞLİ MODDA KAZANANIN TAKIM ARKADAŞI CEZA YEMEZ
        if (state.mode === 'team' && i === partnerIdx) {
            roundScores[i] = 0;
            continue;
        }

        // KAZANAMAYAN OYUNCULAR
        let basePenalty = 0;
        if (!p.opened) {
            basePenalty = 202; // Açmamışsa
        } else {
            basePenalty = parseInt(p.score) || 0; // Açmışsa elindeki taş toplamı
        }

        // Çarpanlar
        let multiplier = 1;
        if (p.double) multiplier *= 2; 
        if (winnerWentDouble) multiplier *= 2; 
        if (winType === 'joker' || winType === 'elden') multiplier *= 2; 
        if (winType === 'elden_joker') multiplier *= 4; 

        roundScores[i] = basePenalty * multiplier;
    }

    for (let i = 0; i < 4; i++) state.totals[i] += roundScores[i];
    
    state.history.push({
        type: 'round',
        roundNum: state.history.filter(h => h.type === 'round').length + 1,
        scores: roundScores,
        details: winnerIdx === -1 ? "Kimse Bitemedi" : `${state.players[winnerIdx]} Bitti (${winType})`
    });

    state.currentRound = getInitialRound();
    saveState();
};

window.addPenalty = function(playerIndex, amount, reason) {
    state.totals[playerIndex] += amount;
    state.history.push({
        type: 'penalty', playerIdx: playerIndex, amount: amount, reason: reason
    });
    saveState();
};

// MAÇI BİTİR VE ARŞİVE EKLE
window.finishMatchAndArchive = function() {
    if(confirm('Maçı bitirip arşive kaydetmek istiyor musunuz? Oyun tahtası sıfırlanacaktır.')) {
        let archives = JSON.parse(localStorage.getItem('okey101Archives')) || [];
        archives.push({
            date: new Date().toLocaleString('tr-TR'),
            mode: state.mode,
            players: state.players,
            totals: state.totals
        });
        localStorage.setItem('okey101Archives', JSON.stringify(archives));
        localStorage.removeItem('okey101State');
        location.reload();
    }
};

// --- ARAYÜZ (UI) OLUŞTURUCU ---
window.render = function() {
    const app = document.getElementById('app');
    
    // 1. KURULUM VE GEÇMİŞ EKRANI
    if (state.screen === 'setup') {
        let archives = JSON.parse(localStorage.getItem('okey101Archives')) || [];
        let archiveHTML = archives.length === 0 ? '<p style="text-align:center; color:#94a3b8;">Henüz bitirilmiş maç yok.</p>' : archives.slice().reverse().map(a => `
            <div class="archive-card">
                <span class="archive-date">${a.date} - ${a.mode === 'team' ? 'Eşli Oyun' : 'Tekli Oyun'}</span>
                <div class="archive-result">
                    ${a.mode === 'team' 
                        ? `<strong>Takım A (${a.players[0]} & ${a.players[2]}):</strong> ${a.totals[0] + a.totals[2]} Puan<br>
                           <strong>Takım B (${a.players[1]} & ${a.players[3]}):</strong> ${a.totals[1] + a.totals[3]} Puan`
                        : `${a.players[0]}: ${a.totals[0]} | ${a.players[1]}: ${a.totals[1]} <br> ${a.players[2]}: ${a.totals[2]} | ${a.players[3]}: ${a.totals[3]}`
                    }
                </div>
            </div>
        `).join('');

        app.innerHTML = `
            <div class="card">
                <h1>Yeni 101 Okey Oyunu</h1>
                <div class="mode-selector">
                    <button class="${state.mode === 'single' ? 'btn-primary' : 'btn-outline'}" onclick="state.mode='single'; saveState();">Tekli</button>
                    <button class="${state.mode === 'team' ? 'btn-primary' : 'btn-outline'}" onclick="state.mode='team'; saveState();">Eşli</button>
                </div>
                
                <p style="font-size:12px; color:#64748b; margin-bottom:10px; text-align:center;">
                    ${state.mode === 'team' ? 'Not: 1 ve 3. Oyuncu (Takım A) | 2 ve 4. Oyuncu (Takım B) eşlidir.' : ''}
                </p>

                <input type="text" placeholder="${state.mode === 'team' ? 'Takım A - 1. Oyuncu' : '1. Oyuncu'}" value="${state.players[0]}" onchange="state.players[0]=this.value; saveState(false);">
                <input type="text" placeholder="${state.mode === 'team' ? 'Takım B - 1. Oyuncu' : '2. Oyuncu'}" value="${state.players[1]}" onchange="state.players[1]=this.value; saveState(false);">
                <input type="text" placeholder="${state.mode === 'team' ? 'Takım A - 2. Oyuncu' : '3. Oyuncu'}" value="${state.players[2]}" onchange="state.players[2]=this.value; saveState(false);">
                <input type="text" placeholder="${state.mode === 'team' ? 'Takım B - 2. Oyuncu' : '4. Oyuncu'}" value="${state.players[3]}" onchange="state.players[3]=this.value; saveState(false);">
                
                <button class="btn-success" style="margin-top:10px;" onclick="state.screen='game'; saveState();">Oyunu Başlat</button>
            </div>

            <div class="card">
                <h2>Eski Maçlar (Arşiv)</h2>
                ${archiveHTML}
            </div>
        `;
        return;
    }

    // 2. OYUN EKRANI
    let scoreboardHTML = "";
    if (state.mode === 'team') {
        let teamA = state.totals[0] + state.totals[2];
        let teamB = state.totals[1] + state.totals[3];
        scoreboardHTML = `
            <div class="score-box" style="border-right: 2px solid #e5e7eb;">
                <h4>Takım A (${state.players[0].substring(0,5)} & ${state.players[2].substring(0,5)})</h4>
                <div class="${state.hideScores ? 'hidden-score' : 'total'}">${state.hideScores ? '***' : teamA}</div>
            </div>
            <div class="score-box">
                <h4>Takım B (${state.players[1].substring(0,5)} & ${state.players[3].substring(0,5)})</h4>
                <div class="${state.hideScores ? 'hidden-score' : 'total'}">${state.hideScores ? '***' : teamB}</div>
            </div>
        `;
    } else {
        scoreboardHTML = state.players.map((p, i) => `
            <div class="score-box">
                <h4>${p}</h4>
                <div class="${state.hideScores ? 'hidden-score' : 'total'}">${state.hideScores ? '***' : state.totals[i]}</div>
            </div>
        `).join('');
    }

    let gameHTML = `
        <div class="scoreboard-header">
            <h2 style="margin:0;">101 Okey</h2>
            <button class="${state.hideScores ? 'btn-primary' : 'btn-outline'} btn-small" style="width:auto;" onclick="state.hideScores = !state.hideScores; saveState();">
                ${state.hideScores ? 'Skoru Göster' : 'Skoru Gizle'}
            </button>
        </div>

        <div class="scoreboard ${state.mode === 'team' ? 'team-mode' : ''}">
            ${scoreboardHTML}
        </div>

        <div class="card">
            <h2>Masadaki Durum</h2>
            <div class="players-grid">
                ${[0,1,2,3].map(i => {
                    let pData = state.currentRound[`p${i}`];
                    return `
                    <div class="player-card">
                        <h4>${state.players[i]}</h4>
                        <div class="checkbox-group">
                            <label>
                                <input type="checkbox" ${pData.opened ? 'checked' : ''} 
                                onchange="handleCheckbox(${i}, 'opened', this.checked)"> Elini Açtı
                            </label>
                            <label>
                                <input type="checkbox" ${pData.double ? 'checked' : ''} 
                                onchange="handleCheckbox(${i}, 'double', this.checked)"> Çifte Gitti
                            </label>
                        </div>
                        <input type="number" id="score-input-${i}" placeholder="Eldeki Sayı" value="${pData.score}" 
                            ${!pData.opened ? 'disabled' : ''} 
                            oninput="handleScoreInput(${i}, this.value)">
                        
                        <div class="penalty-actions">
                            <button class="btn-danger btn-small" onclick="addPenalty(${i}, 101, '101 Ceza')">+101</button>
                            <button class="btn-warning btn-small" onclick="addPenalty(${i}, -101, 'Ceza İptal')">-101</button>
                            <button class="btn-outline btn-small" style="grid-column: span 2;" onclick="askCustomPenalty(${i})">Özel Ceza / Puan Ekle</button>
                        </div>
                    </div>
                    `
                }).join('')}
            </div>
        </div>

        <div class="card finish-area">
            <h2>Eli Bitir</h2>
            <select onchange="state.currentRound.winner = this.value; saveState(false);">
                <option value="-1" ${state.currentRound.winner == "-1" ? 'selected' : ''}>Masada Kimse Bitemedi (Taş Bitti)</option>
                ${state.players.map((p, i) => `
                    <option value="${i}" ${state.currentRound.winner == i ? 'selected' : ''}>${p} BİTİRDİ</option>
                `).join('')}
            </select>
            
            <select onchange="state.currentRound.winType = this.value; saveState(false);" ${state.currentRound.winner == "-1" ? 'disabled' : ''}>
                <option value="normal" ${state.currentRound.winType == "normal" ? 'selected' : ''}>Normal Bitti</option>
                <option value="joker" ${state.currentRound.winType == "joker" ? 'selected' : ''}>Joker Atarak Bitti (x2)</option>
                <option value="elden" ${state.currentRound.winType == "elden" ? 'selected' : ''}>Tek Elde Açtı / Elden Bitti (x2)</option>
                <option value="elden_joker" ${state.currentRound.winType == "elden_joker" ? 'selected' : ''}>Elden + Joker Bitti (x4)</option>
            </select>

            <button class="btn-success" onclick="calculateRound()">Eli Hesapla ve Tabloya Ekle</button>
        </div>

        <button class="btn-danger" style="margin-top:15px; margin-bottom:15px;" onclick="finishMatchAndArchive()">Maçı Bitir ve Arşive Ekle</button>
    `;
    app.innerHTML = gameHTML;
}

// Uygulamayı Başlat
render();
