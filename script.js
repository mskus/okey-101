let isTeamMode = false;
let players = [];
let roundCount = 0;

// Sayfa yüklendiğinde yarım kalan oyunu ve geçmişi kontrol et
window.onload = () => {
    loadHistory();
    checkActiveGame();
};

// Mod Değiştirme
document.getElementById('singleModeBtn').onclick = () => {
    isTeamMode = false;
    document.getElementById('p3').style.display = 'block';
    document.getElementById('p4').style.display = 'block';
    updateButtons('singleModeBtn', 'teamModeBtn');
};

document.getElementById('teamModeBtn').onclick = () => {
    isTeamMode = true;
    document.getElementById('p3').style.display = 'none';
    document.getElementById('p4').style.display = 'none';
    updateButtons('teamModeBtn', 'singleModeBtn');
};

function updateButtons(active, inactive) {
    document.getElementById(active).classList.add('active');
    document.getElementById(inactive).classList.remove('active');
}

// Oyunu Başlat
document.getElementById('startGame').onclick = () => {
    players = isTeamMode 
        ? [document.getElementById('p1').value || 'Takım A', document.getElementById('p2').value || 'Takım B']
        : [document.getElementById('p1').value || 'Oyn 1', document.getElementById('p2').value || 'Oyn 2', document.getElementById('p3').value || 'Oyn 3', document.getElementById('p4').value || 'Oyn 4'];
    
    startUI();
    addRoundRow();
    saveGameState(); // Oyunu başlar başlamaz kaydet
};

function startUI() {
    document.getElementById('game-setup').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
    
    const header = document.getElementById('tableHeader');
    header.innerHTML = '<th>El</th>' + players.map(p => `<th>${p}</th>`).join('');
}

// Toplam Skor Gizle/Göster
document.getElementById('toggleTotals').onclick = () => {
    document.getElementById('totalsSection').classList.toggle('hidden');
};

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
                    <button class="finish-btn btn-biter" onclick="setScore(${idx}, -101)">Biter</button>
                    <button class="finish-btn btn-cift" onclick="setScore(${idx}, -202)">Çift</button>
                </div>
            </td>`;
    });
    
    tr.innerHTML = cells;
    tbody.appendChild(tr);
    updateTotals();
}

// Biter ve Çift Biter İşlemleri
window.setScore = (playerIdx, value) => {
    const rows = document.querySelectorAll('#scoreBody tr');
    const lastRow = rows[rows.length - 1];
    const input = lastRow.querySelector(`.p-${playerIdx}`);
    input.value = value;
    updateTotals(); 
};

// Toplamları Hesapla ve OTOMATİK KAYDET
window.updateTotals = () => {
    const allRows = document.querySelectorAll('#score
