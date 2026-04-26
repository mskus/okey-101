let isTeamMode = false;
let players = [];
let roundCount = 0;

// Sayfa açıldığında verileri geri yükle
window.onload = () => {
    loadHistory();
    checkActiveGame();
};

// Mod Değişimi
document.getElementById('singleModeBtn').onclick = () => {
    isTeamMode = false;
    document.getElementById('p3').style.display = 'block';
    document.getElementById('p4').style.display = 'block';
    document.getElementById('p1').placeholder = "1. Oyuncu";
    document.getElementById('p2').placeholder = "2. Oyuncu";
    updateButtons('singleModeBtn', 'teamModeBtn');
};

document.getElementById('teamModeBtn').onclick = () => {
    isTeamMode = true;
    document.getElementById('p3').style.display = 'none';
    document.getElementById('p4').style.display = 'none';
    document.getElementById('p1').placeholder = "Takım A";
    document.getElementById('p2').placeholder = "Takım B";
    updateButtons('teamModeBtn', 'singleModeBtn');
};

function updateButtons(activeId, inactiveId) {
    document.getElementById(activeId).classList.add('active');
    document.getElementById(inactiveId).classList.remove('active');
}

// Oyunu Başlat
document.getElementById('startGame').onclick = () => {
    players = isTeamMode 
        ? [document.getElementById('p1').value || 'Takım A', document.getElementById('p2').value || 'Takım B']
        : [document.getElementById('p1').value || 'Oyn 1', document.getElementById('p2').value || 'Oyn 2', document.getElementById('p3').value || 'Oyn 3', document.getElementById('p4').value || 'Oyn 4'];
    
    roundCount = 0;
    document.getElementById('scoreBody').innerHTML = ''; // Temizle
    
    startUI();
    addRoundRow();
    saveGameState();
};

function startUI() {
    document.getElementById('game-setup').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
    const header = document.getElementById('tableHeader');
    header.innerHTML = '<th class="round-num">El</th>' + players.map(p => `<th>${p}</th>`).join('');
}

// Toplam Gizle/Göster
document.getElementById('toggleTotals').onclick = () => {
    document.getElementById('totalsSection').classList.toggle('hidden');
};

// Yeni El Ekle
document.getElementById('addRound').onclick = () => {
    addRoundRow();
    saveGameState();
};

function addRoundRow(existingScores = null) {
    roundCount++;
    const tbody = document.getElementById('scoreBody');
    const tr = document.createElement('tr');
    
    let cells = `<td class="round-num">${roundCount}</td>`;
    
    players.forEach((_, idx) => {
        let val = existingScores ? existingScores[idx] : 0;
        cells += `
            <td>
                <input type="number" class="score-input p-${idx}" value="${val}" oninput="updateTotals()">
                <div class="action-btns">
                    <button class="btn-success" onclick="setScore(${idx}, -101)">Biter</button>
                    <button class="btn-primary" onclick="setScore(${idx}, -202)">Çift</button>
                </div>
            </td>`;
    });
    
    tr.innerHTML = cells;
    tbody.appendChild(tr);
    updateTotals();
}

// Hızlı Bitiş Skoru
window.setScore = (playerIdx, value) => {
    const rows = document.querySelectorAll('#scoreBody tr');
    const lastRow = rows[rows.length - 1];
    const input = lastRow.querySelector(`.p-${playerIdx}`);
    input.value = value;
    updateTotals(); 
};

// Toplamları Hesapla ve OTOMATİK KAYDET
window.updateTotals = () => {
    const allRows = document.querySelectorAll('#scoreBody tr');
    let totals = new Array(players.length).fill(0);
    
    allRows.forEach(row => {
        players.forEach((_, idx) => {
            const val = parseInt(row.querySelector(`.p-${idx}`).value) || 0;
            totals[idx] += val;
        });
    });

    const footer = document.getElementById('totalScores');
    footer.innerHTML = '<td class="round-num">TOP</td>' + totals.map(t => `<td>${t}</td>`).join('');
    
    saveGameState();
};

// AKTİF OYUNU KAYDETME MANTIĞI (Veri Kaybını Önler)
function saveGameState() {
    if (players.length === 0) return; 

    const allRows = document.querySelectorAll('#scoreBody tr');
    let roundsData = [];
    
    allRows.forEach(row => {
        let rowScores = [];
        players.forEach((_, idx) => {
            rowScores.push(parseInt(row.querySelector(`.p-${idx}`).value) || 0);
        });
        roundsData.push(rowScores);
    });

    localStorage.setItem('activeOkeyGame', JSON.stringify({
        players: players,
        isTeamMode: isTeamMode,
        rounds: roundsData
    }));
}

// YARIM KALAN OYUNU YÜKLE
function checkActiveGame() {
    const savedGame = localStorage.getItem('activeOkeyGame');
    if (savedGame) {
        const game = JSON.parse(savedGame);
        players = game.players;
        isTeamMode = game.isTeamMode;
        roundCount = 0; // addRoundRow içinde artacak
        
        startUI();
        game.rounds.forEach(roundScores => {
            addRoundRow(roundScores);
        });
    }
}

// MAÇI BİTİR VE GEÇMİŞE EKLE
document.getElementById('finishGame').onclick = () => {
    if(!confirm("Maçı bitirmek ve kaydetmek istediğine emin misin?")) return;

    const totals = Array.from(document.getElementById('totalScores').cells).slice(1).map(c => c.innerText);
    const resultText = players.map((p, i) => `${p}: ${totals[i]} Puan`).join(' | ');

    const log = {
        date: new Date().toLocaleString('tr-TR'),
        mode: isTeamMode ? 'Eşli Oyun' : 'Tekli Oyun',
        result: resultText,
        totalRounds: roundCount
    };
    
    let history = JSON.parse(localStorage.getItem('okeyHistory') || '[]');
    history.push(log);
    localStorage.setItem('okeyHistory', JSON.stringify(history));
    
    localStorage.removeItem('activeOkeyGame'); 
    alert('Oyun Başarıyla Kaydedildi!');
    location.reload();
};

// GEÇMİŞ MAÇLARI LİSTELE
function loadHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '';
    let history = JSON.parse(localStorage.getItem('okeyHistory') || '[]');
    
    if(history.length === 0) {
        list.innerHTML = '<p style="color:#64748b; text-align:center;">Henüz kaydedilmiş bir maç yok.</p>';
        return;
    }

    history.reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span class="history-date">${item.date}</span>
            <div><strong>Mod:</strong> ${item.mode} (${item.totalRounds} El Oynandı)</div>
            <div class="history-result">${item.result}</div>
        `;
        list.appendChild(div);
    });
}
