// Badminton Doubles Score Sheet App - Enhanced Edition

class BadmintonScoreSheet {
    constructor() {
        this.match = null;
        this.STORAGE_KEY = 'badminton-player-names';
        this.HISTORY_KEY = 'badminton-match-history';
        this.THEME_KEY = 'badminton-theme';
        this.serviceSide = 'right'; // right or left
        this.soundEnabled = true;
        this.initTheme();
        this.initEventListeners();
        this.loadPlayerNames();
        this.initSounds();
    }

    // --- Theme ---
    initTheme() {
        const saved = localStorage.getItem(this.THEME_KEY) || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
        this.updateThemeIcon(saved);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(this.THEME_KEY, next);
        this.updateThemeIcon(next);
    }

    updateThemeIcon(theme) {
        const btn = document.getElementById('btn-theme-toggle');
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    // --- Sound Effects ---
    initSounds() {
        this.audioCtx = null;
    }

    getAudioCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioCtx;
    }

    playScoreSound() {
        if (!this.soundEnabled) return;
        try {
            const ctx = this.getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } catch(e) {}
    }

    playErrorSound() {
        if (!this.soundEnabled) return;
        try {
            const ctx = this.getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 300;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        } catch(e) {}
    }

    playWinSound() {
        if (!this.soundEnabled) return;
        try {
            const ctx = this.getAudioCtx();
            const notes = [523, 659, 784, 1047];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
                osc.start(ctx.currentTime + i * 0.15);
                osc.stop(ctx.currentTime + i * 0.15 + 0.3);
            });
        } catch(e) {}
    }

    // --- Player Name Autocomplete ---
    getSavedPlayerNames() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    savePlayerNames(names) {
        const existing = this.getSavedPlayerNames();
        const updated = [...new Set([...existing, ...names])].filter(n => n && n.trim());
        updated.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
        this.loadPlayerNames();
    }

    loadPlayerNames() {
        const names = this.getSavedPlayerNames();
        const datalist = document.getElementById('player-names');
        datalist.innerHTML = names.map(name => `<option value="${name}">`).join('');
    }

    // --- Match History ---
    getMatchHistory() {
        try {
            const data = localStorage.getItem(this.HISTORY_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    saveMatchToHistory() {
        const history = this.getMatchHistory();
        const record = {
            id: Date.now(),
            date: new Date().toISOString(),
            teamA: this.match.teamA,
            teamB: this.match.teamB,
            sets: this.match.sets.map(s => ({ scoreA: s.scoreA, scoreB: s.scoreB })),
            setsWon: this.match.setsWon,
            winner: this.match.winner,
            errors: this.match.allErrors.length,
            duration: this.getMatchDuration()
        };
        history.unshift(record);
        // Keep last 100 matches
        if (history.length > 100) history.pop();
        localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    }

    // --- Event Listeners ---
    initEventListeners() {
        document.getElementById('start-match').addEventListener('click', () => this.startMatch());
        document.getElementById('btn-scoreA').addEventListener('click', () => this.addPoint('A'));
        document.getElementById('btn-scoreB').addEventListener('click', () => this.addPoint('B'));
        document.getElementById('btn-record-error').addEventListener('click', () => this.recordError());
        document.getElementById('btn-undo').addEventListener('click', () => this.undoLast());
        document.getElementById('btn-end-match').addEventListener('click', () => this.endMatch());
        document.getElementById('btn-new-match').addEventListener('click', () => this.newMatch());
        document.getElementById('btn-save-summary').addEventListener('click', () => this.saveSummary());
        document.getElementById('btn-share-card').addEventListener('click', () => this.generateShareCard());
        document.getElementById('btn-print').addEventListener('click', () => window.print());
        document.getElementById('btn-theme-toggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('btn-switch-service').addEventListener('click', () => this.switchService());
        document.getElementById('btn-show-history').addEventListener('click', () => this.showHistoryPage());
        document.getElementById('btn-show-leaderboard').addEventListener('click', () => this.showLeaderboard());

        // History filters
        document.getElementById('history-search').addEventListener('input', () => this.renderHistoryPage());
        document.getElementById('history-date').addEventListener('change', () => this.renderHistoryPage());
        document.getElementById('btn-clear-filters').addEventListener('click', () => this.clearHistoryFilters());
        document.getElementById('btn-clear-history').addEventListener('click', () => this.clearHistory());

        // Nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                const section = e.target.dataset.section;
                this.showSection(section);
                if (section === 'history-page') this.renderHistoryPage();
                if (section === 'leaderboard-page') this.renderLeaderboard();
            });
        });
    }

    // --- Service Tracking ---
    switchService() {
        this.servingTeam = this.servingTeam === 'A' ? 'B' : 'A';
        this.updateServiceDisplay();
    }

    updateServiceDisplay() {
        const leftLabel = document.getElementById('service-label-left');
        const rightLabel = document.getElementById('service-label-right');
        if (this.match) {
            leftLabel.textContent = this.match.teamA.name;
            rightLabel.textContent = this.match.teamB.name;
        }
        document.getElementById('service-left').classList.toggle('active', this.servingTeam === 'A');
        document.getElementById('service-right').classList.toggle('active', this.servingTeam === 'B');
    }

    // --- Match Start ---
    startMatch() {
        const teamA1 = document.getElementById('teamA-player1').value.trim() || 'Player A1';
        const teamA2 = document.getElementById('teamA-player2').value.trim() || 'Player A2';
        const teamB1 = document.getElementById('teamB-player1').value.trim() || 'Player B1';
        const teamB2 = document.getElementById('teamB-player2').value.trim() || 'Player B2';
        const format = parseInt(document.getElementById('match-format').value);
        const pointsPerSet = parseInt(document.getElementById('points-per-set').value);

        this.savePlayerNames([teamA1, teamA2, teamB1, teamB2]);

        this.match = {
            teamA: { players: [teamA1, teamA2], name: `${teamA1} / ${teamA2}` },
            teamB: { players: [teamB1, teamB2], name: `${teamB1} / ${teamB2}` },
            format, pointsPerSet,
            currentSet: 1,
            sets: [{ scoreA: 0, scoreB: 0, history: [], errors: [] }],
            setsWon: { A: 0, B: 0 },
            allErrors: [],
            isFinished: false,
            startTime: new Date()
        };

        this.servingTeam = 'A';
        document.getElementById('teamA-name').textContent = this.match.teamA.name;
        document.getElementById('teamB-name').textContent = this.match.teamB.name;
        this.updateErrorPlayerOptions();
        this.updateServiceDisplay();
        this.showSection('scoreboard-section');
        this.updateDisplay();
    }

    updateErrorPlayerOptions() {
        const teamSelect = document.getElementById('error-team');
        const playerSelect = document.getElementById('error-player');
        const updatePlayers = () => {
            const team = teamSelect.value === 'A' ? this.match.teamA : this.match.teamB;
            playerSelect.innerHTML = `
                <option value="1">${team.players[0]}</option>
                <option value="2">${team.players[1]}</option>`;
        };
        teamSelect.removeEventListener('change', updatePlayers);
        teamSelect.addEventListener('change', updatePlayers);
        updatePlayers();
    }

    getCurrentSet() {
        return this.match.sets[this.match.currentSet - 1];
    }

    addPoint(team) {
        if (this.match.isFinished) return;
        const set = this.getCurrentSet();
        if (team === 'A') set.scoreA++;
        else set.scoreB++;

        set.history.push({
            type: 'point', team,
            scoreA: set.scoreA, scoreB: set.scoreB,
            time: new Date()
        });

        // Auto-switch service to the team that scored
        this.servingTeam = team;
        this.updateServiceDisplay();

        this.playScoreSound();
        this.animateScore(team);
        this.updateDisplay();
        this.checkSetEnd();
    }

    animateScore(team) {
        const el = document.getElementById(team === 'A' ? 'scoreA' : 'scoreB');
        el.classList.remove('animate');
        void el.offsetWidth; // reflow
        el.classList.add('animate');
    }

    recordError() {
        if (this.match.isFinished) return;
        const team = document.getElementById('error-team').value;
        const playerIndex = parseInt(document.getElementById('error-player').value) - 1;
        const errorType = document.getElementById('error-type').value;
        const errorTypeLabel = document.getElementById('error-type').selectedOptions[0].text;
        const teamObj = team === 'A' ? this.match.teamA : this.match.teamB;
        const playerName = teamObj.players[playerIndex];

        const error = { team, playerIndex, playerName, errorType, errorTypeLabel, set: this.match.currentSet, time: new Date() };
        const set = this.getCurrentSet();
        set.errors.push(error);
        this.match.allErrors.push(error);

        const opposingTeam = team === 'A' ? 'B' : 'A';
        if (opposingTeam === 'A') set.scoreA++;
        else set.scoreB++;

        set.history.push({
            type: 'error', team: opposingTeam, errorTeam: team,
            playerName, errorType: errorTypeLabel,
            scoreA: set.scoreA, scoreB: set.scoreB, time: new Date()
        });

        this.playErrorSound();
        this.animateScore(opposingTeam);

        // Service goes to the team that gained the point (opposing team)
        this.servingTeam = opposingTeam;
        this.updateServiceDisplay();

        this.updateDisplay();
        this.checkSetEnd();
    }

    undoLast() {
        const set = this.getCurrentSet();
        if (set.history.length === 0) return;
        const lastEntry = set.history.pop();
        if (lastEntry.type === 'error') { set.errors.pop(); this.match.allErrors.pop(); }
        if (set.history.length > 0) {
            const prev = set.history[set.history.length - 1];
            set.scoreA = prev.scoreA; set.scoreB = prev.scoreB;
        } else { set.scoreA = 0; set.scoreB = 0; }
        this.updateDisplay();
    }

    checkSetEnd() {
        const set = this.getCurrentSet();
        const target = this.match.pointsPerSet;
        let setWon = false, winner = null;

        if (set.scoreA >= target && set.scoreA - set.scoreB >= 2) { setWon = true; winner = 'A'; }
        else if (set.scoreB >= target && set.scoreB - set.scoreA >= 2) { setWon = true; winner = 'B'; }
        else if (set.scoreA === 30 || set.scoreB === 30) { setWon = true; winner = set.scoreA >= set.scoreB ? 'A' : 'B'; }

        if (setWon) {
            this.match.setsWon[winner]++;
            const setsToWin = Math.ceil(this.match.format / 2);
            if (this.match.setsWon[winner] >= setsToWin) {
                this.match.isFinished = true;
                this.match.winner = winner;
                this.match.endTime = new Date();
                this.playWinSound();
                this.saveMatchToHistory();
                setTimeout(() => this.showSummary(), 500);
            } else {
                this.match.currentSet++;
                this.match.sets.push({ scoreA: 0, scoreB: 0, history: [], errors: [] });
                this.servingTeam = 'A';
                this.updateServiceDisplay();
                this.updateDisplay();
            }
        }
    }

    updateDisplay() {
        const set = this.getCurrentSet();
        document.getElementById('scoreA').textContent = set.scoreA;
        document.getElementById('scoreB').textContent = set.scoreB;
        document.getElementById('current-set').textContent = `Set ${this.match.currentSet}`;

        const setScoresArr = [];
        for (let i = 0; i < this.match.sets.length - 1; i++) {
            const s = this.match.sets[i];
            setScoresArr.push(`${s.scoreA}-${s.scoreB}`);
        }
        document.getElementById('set-scores').textContent = setScoresArr.length > 0 ? `(${setScoresArr.join(', ')})` : '';
        this.renderHistory();
    }

    renderHistory() {
        const set = this.getCurrentSet();
        const container = document.getElementById('point-history');
        container.innerHTML = '';
        set.history.slice().reverse().forEach(entry => {
            const div = document.createElement('div');
            const time = new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (entry.type === 'error') {
                div.className = 'point-entry error';
                div.innerHTML = `<span>⚠️ ${entry.errorType} by ${entry.playerName} → Point to Team ${entry.team}</span><span class="timestamp">${entry.scoreA}-${entry.scoreB} | ${time}</span>`;
            } else {
                div.className = `point-entry team-${entry.team.toLowerCase()}`;
                const teamName = entry.team === 'A' ? this.match.teamA.name : this.match.teamB.name;
                div.innerHTML = `<span>✓ Point to ${teamName}</span><span class="timestamp">${entry.scoreA}-${entry.scoreB} | ${time}</span>`;
            }
            container.appendChild(div);
        });
    }

    endMatch() {
        if (confirm('End match early? The current score will be used for the summary.')) {
            this.match.isFinished = true;
            this.match.endTime = new Date();
            if (this.match.setsWon.A > this.match.setsWon.B) this.match.winner = 'A';
            else if (this.match.setsWon.B > this.match.setsWon.A) this.match.winner = 'B';
            else {
                const set = this.getCurrentSet();
                this.match.winner = set.scoreA >= set.scoreB ? 'A' : 'B';
            }
            this.saveMatchToHistory();
            this.showSummary();
        }
    }

    showSummary() {
        this.showSection('summary-section');
        const winnerTeam = this.match.winner === 'A' ? this.match.teamA : this.match.teamB;
        const loserTeam = this.match.winner === 'A' ? this.match.teamB : this.match.teamA;

        document.getElementById('match-result').innerHTML = `
            <h2>🏆 ${winnerTeam.name}</h2>
            <p>defeats ${loserTeam.name}</p>
            <p style="margin-top:8px; color:var(--text-faint);">
                Sets: ${this.match.setsWon.A} - ${this.match.setsWon.B} | Duration: ${this.getMatchDuration()}
            </p>`;

        let setHTML = '<table><tr><th>Set</th><th>Team A</th><th>Team B</th></tr>';
        this.match.sets.forEach((set, i) => { setHTML += `<tr><td>Set ${i+1}</td><td>${set.scoreA}</td><td>${set.scoreB}</td></tr>`; });
        setHTML += '</table>';
        document.getElementById('set-results').innerHTML = setHTML;

        const errorsA = this.match.allErrors.filter(e => e.team === 'A').length;
        const errorsB = this.match.allErrors.filter(e => e.team === 'B').length;
        document.getElementById('error-summary').innerHTML = `<table>
            <tr><th>Team</th><th>Total Errors</th></tr>
            <tr><td>${this.match.teamA.name}</td><td>${errorsA}</td></tr>
            <tr><td>${this.match.teamB.name}</td><td>${errorsB}</td></tr>
            <tr><td><strong>Total</strong></td><td><strong>${errorsA + errorsB}</strong></td></tr></table>`;

        const playerErrorMap = {};
        this.match.allErrors.forEach(e => { playerErrorMap[e.playerName] = (playerErrorMap[e.playerName] || 0) + 1; });
        let peHTML = '<table><tr><th>Player</th><th>Errors</th></tr>';
        Object.entries(playerErrorMap).sort((a,b) => b[1]-a[1]).forEach(([n,c]) => { peHTML += `<tr><td>${n}</td><td>${c}</td></tr>`; });
        if (!Object.keys(playerErrorMap).length) peHTML += '<tr><td colspan="2">No errors recorded</td></tr>';
        peHTML += '</table>';
        document.getElementById('player-errors').innerHTML = peHTML;

        const errorTypeMap = {};
        this.match.allErrors.forEach(e => { errorTypeMap[e.errorTypeLabel] = (errorTypeMap[e.errorTypeLabel] || 0) + 1; });
        let etHTML = '<table><tr><th>Error Type</th><th>Count</th></tr>';
        Object.entries(errorTypeMap).sort((a,b) => b[1]-a[1]).forEach(([t,c]) => { etHTML += `<tr><td>${t}</td><td>${c}</td></tr>`; });
        if (!Object.keys(errorTypeMap).length) etHTML += '<tr><td colspan="2">No errors recorded</td></tr>';
        etHTML += '</table>';
        document.getElementById('error-types-summary').innerHTML = etHTML;
    }

    getMatchDuration() {
        if (!this.match.startTime || !this.match.endTime) return 'N/A';
        const diff = this.match.endTime - this.match.startTime;
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    saveSummary() {
        const winnerTeam = this.match.winner === 'A' ? this.match.teamA : this.match.teamB;
        const loserTeam = this.match.winner === 'A' ? this.match.teamB : this.match.teamA;
        const date = new Date().toLocaleDateString();
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let text = '═══════════════════════════════════════════\n';
        text += '       BADMINTON DOUBLES - MATCH SUMMARY\n';
        text += '═══════════════════════════════════════════\n';
        text += `Date: ${date}  |  Time: ${time}\n`;
        text += `Duration: ${this.getMatchDuration()}\n\n`;
        text += `🏆 WINNER: ${winnerTeam.name}\n`;
        text += `   defeated ${loserTeam.name}\n`;
        text += `   Sets: ${this.match.setsWon.A} - ${this.match.setsWon.B}\n\n`;
        text += '───────────────────────────────────────────\n SET RESULTS\n───────────────────────────────────────────\n';
        text += `  ${'Set'.padEnd(8)}${'Team A'.padEnd(10)}Team B\n`;
        this.match.sets.forEach((set, i) => { text += `  ${('Set '+(i+1)).padEnd(8)}${String(set.scoreA).padEnd(10)}${set.scoreB}\n`; });

        const errorsA = this.match.allErrors.filter(e => e.team === 'A').length;
        const errorsB = this.match.allErrors.filter(e => e.team === 'B').length;
        text += `\n───────────────────────────────────────────\n ERROR SUMMARY\n───────────────────────────────────────────\n`;
        text += `  ${this.match.teamA.name}: ${errorsA} errors\n  ${this.match.teamB.name}: ${errorsB} errors\n  Total: ${errorsA+errorsB} errors\n`;
        text += '═══════════════════════════════════════════\n';

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `match-summary_${date.replace(/\//g,'-')}_${time.replace(/:/g,'')}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Share Card (Canvas Image) ---
    generateShareCard() {
        const canvas = document.getElementById('share-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 400;

        // Background
        const grad = ctx.createLinearGradient(0, 0, 600, 400);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(1, '#0f3460');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 600, 400);

        // Border
        ctx.strokeStyle = '#64ffda';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, 580, 380);

        // Title
        ctx.fillStyle = '#64ffda';
        ctx.font = 'bold 22px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('🏸 SPARK Badminton', 300, 50);

        // Winner
        const winnerTeam = this.match.winner === 'A' ? this.match.teamA : this.match.teamB;
        const loserTeam = this.match.winner === 'A' ? this.match.teamB : this.match.teamA;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Segoe UI';
        ctx.fillText(`🏆 ${winnerTeam.name}`, 300, 100);
        ctx.fillStyle = '#b0bec5';
        ctx.font = '16px Segoe UI';
        ctx.fillText(`defeats ${loserTeam.name}`, 300, 130);

        // Score
        ctx.fillStyle = '#ffab40';
        ctx.font = 'bold 18px Segoe UI';
        ctx.fillText(`Sets: ${this.match.setsWon.A} - ${this.match.setsWon.B}`, 300, 170);

        // Set details
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px Segoe UI';
        this.match.sets.forEach((set, i) => {
            ctx.fillText(`Set ${i+1}: ${set.scoreA} - ${set.scoreB}`, 300, 210 + i * 28);
        });

        // Date & Duration
        ctx.fillStyle = '#78909c';
        ctx.font = '13px Segoe UI';
        ctx.fillText(`${new Date().toLocaleDateString()} | Duration: ${this.getMatchDuration()}`, 300, 350);

        // Errors
        const totalErrors = this.match.allErrors.length;
        ctx.fillText(`Total Errors: ${totalErrors}`, 300, 375);

        // Show preview and download link
        const dataUrl = canvas.toDataURL('image/png');
        const preview = document.getElementById('share-preview');
        preview.classList.remove('hidden');
        preview.innerHTML = `
            <img src="${dataUrl}" alt="Match Card">
            <p style="margin-top:12px;">
                <a href="${dataUrl}" download="match-card.png" class="btn btn-primary btn-sm">⬇ Download Image</a>
            </p>`;
    }

    // --- History Page ---
    showHistoryPage() {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-section="history-page"]').classList.add('active');
        this.showSection('history-page');
        this.renderHistoryPage();
    }

    renderHistoryPage() {
        const history = this.getMatchHistory();
        const search = document.getElementById('history-search').value.toLowerCase();
        const dateFilter = document.getElementById('history-date').value;
        const container = document.getElementById('history-list');

        const filtered = history.filter(m => {
            const players = [...m.teamA.players, ...m.teamB.players].join(' ').toLowerCase();
            const matchDate = m.date.split('T')[0];
            if (search && !players.includes(search)) return false;
            if (dateFilter && matchDate !== dateFilter) return false;
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">No matches found.</p>';
            return;
        }

        container.innerHTML = filtered.map(m => {
            const date = new Date(m.date).toLocaleDateString();
            const time = new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const winnerName = m.winner === 'A' ? m.teamA.name : m.teamB.name;
            const scores = m.sets.map(s => `${s.scoreA}-${s.scoreB}`).join(', ');
            return `<div class="history-item">
                <div class="match-date">${date} ${time} | Duration: ${m.duration}</div>
                <div class="match-teams">${m.teamA.name} vs ${m.teamB.name}</div>
                <div class="match-score">Sets: ${m.setsWon.A}-${m.setsWon.B} (${scores})</div>
                <div class="match-winner">🏆 Winner: ${winnerName}</div>
            </div>`;
        }).join('');
    }

    clearHistoryFilters() {
        document.getElementById('history-search').value = '';
        document.getElementById('history-date').value = '';
        this.renderHistoryPage();
    }

    clearHistory() {
        if (confirm('Delete all match history? This cannot be undone.')) {
            localStorage.removeItem(this.HISTORY_KEY);
            this.renderHistoryPage();
        }
    }

    // --- Leaderboard ---
    showLeaderboard() {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-section="leaderboard-page"]').classList.add('active');
        this.showSection('leaderboard-page');
        this.renderLeaderboard();
    }

    renderLeaderboard() {
        const history = this.getMatchHistory();
        const playerStats = {};

        history.forEach(m => {
            const allPlayers = [
                { name: m.teamA.players[0], team: 'A' },
                { name: m.teamA.players[1], team: 'A' },
                { name: m.teamB.players[0], team: 'B' },
                { name: m.teamB.players[1], team: 'B' }
            ];

            allPlayers.forEach(p => {
                if (!playerStats[p.name]) {
                    playerStats[p.name] = { wins: 0, losses: 0, matches: 0 };
                }
                playerStats[p.name].matches++;
                if (p.team === m.winner) playerStats[p.name].wins++;
                else playerStats[p.name].losses++;
            });
        });

        const sorted = Object.entries(playerStats)
            .map(([name, stats]) => ({
                name, ...stats,
                winRate: stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0
            }))
            .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

        const container = document.getElementById('leaderboard-content');

        if (sorted.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">No match data yet. Play some matches to see the leaderboard!</p>';
            return;
        }

        let html = `<table>
            <tr><th>#</th><th>Player</th><th>W</th><th>L</th><th>Played</th><th>Win %</th></tr>`;
        sorted.forEach((p, i) => {
            const rankClass = i < 3 ? `rank-${i+1}` : '';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`;
            html += `<tr class="${rankClass}">
                <td>${medal}</td><td>${p.name}</td>
                <td>${p.wins}</td><td>${p.losses}</td>
                <td>${p.matches}</td><td>${p.winRate}%</td></tr>`;
        });
        html += '</table>';
        container.innerHTML = html;
    }

    // --- Utilities ---
    newMatch() {
        this.match = null;
        document.getElementById('teamA-player1').value = '';
        document.getElementById('teamA-player2').value = '';
        document.getElementById('teamB-player1').value = '';
        document.getElementById('teamB-player2').value = '';
        document.getElementById('share-preview').classList.add('hidden');
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-section="setup-section"]').classList.add('active');
        this.showSection('setup-section');
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        document.getElementById(sectionId).classList.remove('hidden');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new BadmintonScoreSheet();
});
