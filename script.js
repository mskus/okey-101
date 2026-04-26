let isTeamMode = false;
let players = [];
let gameData = { rounds: [] };

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
    
    initTable();
    document.getElementById('game-setup').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';
};

function initTable() {
    const header = document.getElementById('tableHeader');
    header.innerHTML = players.map(p => `<th>${p}</th>`).join('');
    addRoundRow();
}

function addRoundRow() {
    const tbody = document.getElementById('scoreBody');
    const tr = document.createElement('tr');
    tr.innerHTML = players.map(() => `<td><input type="number" class="score-input" value="0"></td>`).join('');
    tbody.appendChild(tr);
    updateTotals();
}

document.getElementById('addRound').onclick = addRoundRow;

// Toplamları Hesapla
function updateTotals() {
    const inputs = document.querySelectorAll('.score-input');
    inputs.forEach(input => {
        input.oninput = () => {
            let totals = new Array(players.length).fill(0);
            const rows = document.querySelectorAll('#scoreBody tr');
            rows.forEach(row => {
                const rowInputs = row.querySelectorAll('input');
                rowInputs.forEach((inp, idx) => {
                    totals[idx] += parseInt(inp.value) || 0;
                });
            });
            document.getElementById('totalScores').innerHTML = totals.map(t => `<td>${t}</td>`).join('');
        };
    });
}

// Kaydetme Fonksiyonu
document.getElementById('finishGame').onclick = () => {
    const totals = Array.from(document.getElementById('totalScores').cells).map(c => c.innerText);
    const log = {
        date: new Date().toLocaleString(),
        mode: isTeamMode ? 'Eşli' : 'Tekli',
        result: players.map((p, i) => `${p}: ${totals[i]}`).join(' | ')
    };
    
    let history = JSON.parse(localStorage.getItem('okeyHistory') || '[]');
    history.push(log);
    localStorage.setItem('okeyHistory', JSON.stringify(history));
    alert('Oyun Kaydedildi!');
    location.reload();
};

// Geçmişi Yükle
window.onload = () => {
    let history = JSON.parse(localStorage.getItem('okeyHistory') || '[]');
    const list = document.getElementById('historyList');
    history.reverse().forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerText = `${item.date} [${item.mode}] -> ${item.result}`;
        list.appendChild(li);
    });
};
