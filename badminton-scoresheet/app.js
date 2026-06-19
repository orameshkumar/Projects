// Badminton Doubles Score Sheet App

class BadmintonScoreSheet {
    constructor() {
        this.match = null;
        this.STORAGE_KEY = 'badminton-player-names';
        this.initEventListeners();
        this.loadPlayerNames();
    }

    // --- Player Name Autocomplete ---

    getSavedPlayerNames() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
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

    initEventListeners() {
        document.getElementById('start-match').addEventListener('click', () => this.startMatch());
        document.getElementById('btn-scoreA').addEventListener('click', () => this.addPoint('A'));
        document.getElementById('btn-scoreB').addEventListener('click', () => this.addPoint('B'));
        document.getElementById('btn-record-error').addEventListener('click', () => this.recordError());
        document.getElementById('btn-undo').addEventListener('click', () => this.undoLast());
        document.getElementById('btn-end-match').addEventListener('click', () => this.endMatch());
        document.getElementById('btn-new-match').addEventListener('click', () => this.newMatch());
        document.getElementById('btn-save-summary').addEventListener('click', () => this.saveSummary());
        document.getElementById('btn-print').addEventListener('click', () => window.print());
    }

    startMatch() {
        const teamA1 = document.getElementById('teamA-player1').value.trim() || 'Player A1';
        const teamA2 = document.getElementById('teamA-player2').value.trim() || 'Player A2';
        const teamB1 = document.getElementById('teamB-player1').value.trim() || 'Player B1';
        const teamB2 = document.getElementById('teamB-player2').value.trim() || 'Player B2';
        const format = parseInt(document.getElementById('match-format').value);
        const pointsPerSet = parseInt(document.getElementById('points-per-set').value);

        // Save player names for future autocomplete
        this.savePlayerNames([teamA1, teamA2, teamB1, teamB2]);

        this.match = {
            teamA: { players: [teamA1, teamA2], name: `${teamA1} / ${teamA2}` },
            teamB: { players: [teamB1, teamB2], name: `${teamB1} / ${teamB2}` },
            format: format,
            pointsPerSet: pointsPerSet,
            currentSet: 1,
            sets: [{ scoreA: 0, scoreB: 0, history: [], errors: [] }],
            setsWon: { A: 0, B: 0 },
            allErrors: [],
            isFinished: false,
            startTime: new Date()
        };

        document.getElementById('teamA-name').textContent = this.match.teamA.name;
        document.getElementById('teamB-name').textContent = this.match.teamB.name;

        this.updateErrorPlayerOptions();
        this.showSection('scoreboard-section');
        this.updateDisplay();
    }

    updateErrorPlayerOptions() {
        const teamSelect = document.getElementById('error-team');
        const playerSelect = document.getElementById('error-player');

        // Update player names based on selected team
        teamSelect.addEventListener('change', () => {
            const team = teamSelect.value === 'A' ? this.match.teamA : this.match.teamB;
            playerSelect.innerHTML = `
                <option value="1">${team.players[0]}</option>
                <option value="2">${team.players[1]}</option>
            `;
        });

        // Initialize with Team A players
        const teamA = this.match.teamA;
        playerSelect.innerHTML = `
            <option value="1">${teamA.players[0]}</option>
            <option value="2">${teamA.players[1]}</option>
        `;
    }

    getCurrentSet() {
        return this.match.sets[this.match.currentSet - 1];
    }

    addPoint(team) {
        if (this.match.isFinished) return;

        const set = this.getCurrentSet();
        if (team === 'A') {
            set.scoreA++;
        } else {
            set.scoreB++;
        }

        set.history.push({
            type: 'point',
            team: team,
            scoreA: set.scoreA,
            scoreB: set.scoreB,
            time: new Date()
        });

        this.updateDisplay();
        this.checkSetEnd();
    }

    recordError() {
        if (this.match.isFinished) return;

        const team = document.getElementById('error-team').value;
        const playerIndex = parseInt(document.getElementById('error-player').value) - 1;
        const errorType = document.getElementById('error-type').value;
        const errorTypeLabel = document.getElementById('error-type').selectedOptions[0].text;

        const teamObj = team === 'A' ? this.match.teamA : this.match.teamB;
        const playerName = teamObj.players[playerIndex];

        const error = {
            team: team,
            playerIndex: playerIndex,
            playerName: playerName,
            errorType: errorType,
            errorTypeLabel: errorTypeLabel,
            set: this.match.currentSet,
            time: new Date()
        };

        const set = this.getCurrentSet();
        set.errors.push(error);
        this.match.allErrors.push(error);

        // Error gives point to opposing team
        const opposingTeam = team === 'A' ? 'B' : 'A';
        if (opposingTeam === 'A') {
            set.scoreA++;
        } else {
            set.scoreB++;
        }

        set.history.push({
            type: 'error',
            team: opposingTeam,
            errorTeam: team,
            playerName: playerName,
            errorType: errorTypeLabel,
            scoreA: set.scoreA,
            scoreB: set.scoreB,
            time: new Date()
        });

        this.updateDisplay();
        this.checkSetEnd();
    }

    undoLast() {
        const set = this.getCurrentSet();
        if (set.history.length === 0) return;

        const lastEntry = set.history.pop();

        if (lastEntry.type === 'error') {
            set.errors.pop();
            this.match.allErrors.pop();
        }

        // Restore score from previous state
        if (set.history.length > 0) {
            const prev = set.history[set.history.length - 1];
            set.scoreA = prev.scoreA;
            set.scoreB = prev.scoreB;
        } else {
            set.scoreA = 0;
            set.scoreB = 0;
        }

        this.updateDisplay();
    }

    checkSetEnd() {
        const set = this.getCurrentSet();
        const target = this.match.pointsPerSet;
        let setWon = false;
        let winner = null;

        // Standard badminton rules: win by 2, cap at 30
        if (set.scoreA >= target && set.scoreA - set.scoreB >= 2) {
            setWon = true;
            winner = 'A';
        } else if (set.scoreB >= target && set.scoreB - set.scoreA >= 2) {
            setWon = true;
            winner = 'B';
        } else if (set.scoreA === 30 || set.scoreB === 30) {
            // Cap at 30 - whoever has 30 wins
            setWon = true;
            winner = set.scoreA >= set.scoreB ? 'A' : 'B';
        }

        if (setWon) {
            this.match.setsWon[winner]++;

            const setsToWin = Math.ceil(this.match.format / 2);
            if (this.match.setsWon[winner] >= setsToWin) {
                this.match.isFinished = true;
                this.match.winner = winner;
                this.match.endTime = new Date();
                setTimeout(() => this.showSummary(), 500);
            } else {
                // Start new set
                this.match.currentSet++;
                this.match.sets.push({ scoreA: 0, scoreB: 0, history: [], errors: [] });
                this.updateDisplay();
            }
        }
    }

    updateDisplay() {
        const set = this.getCurrentSet();
        document.getElementById('scoreA').textContent = set.scoreA;
        document.getElementById('scoreB').textContent = set.scoreB;
        document.getElementById('current-set').textContent = `Set ${this.match.currentSet}`;

        // Set scores
        const setScoresArr = [];
        for (let i = 0; i < this.match.sets.length - 1; i++) {
            const s = this.match.sets[i];
            setScoresArr.push(`${s.scoreA}-${s.scoreB}`);
        }
        document.getElementById('set-scores').textContent = setScoresArr.length > 0
            ? `(${setScoresArr.join(', ')})`
            : '';

        // Point history
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
                div.innerHTML = `
                    <span>⚠️ ${entry.errorType} by ${entry.playerName} → Point to Team ${entry.team}</span>
                    <span class="timestamp">${entry.scoreA}-${entry.scoreB} | ${time}</span>
                `;
            } else {
                div.className = `point-entry team-${entry.team.toLowerCase()}`;
                const teamName = entry.team === 'A' ? this.match.teamA.name : this.match.teamB.name;
                div.innerHTML = `
                    <span>✓ Point to ${teamName}</span>
                    <span class="timestamp">${entry.scoreA}-${entry.scoreB} | ${time}</span>
                `;
            }

            container.appendChild(div);
        });
    }

    endMatch() {
        if (confirm('End match early? The current score will be used for the summary.')) {
            this.match.isFinished = true;
            this.match.endTime = new Date();

            // Determine winner based on sets won, or current score
            if (this.match.setsWon.A > this.match.setsWon.B) {
                this.match.winner = 'A';
            } else if (this.match.setsWon.B > this.match.setsWon.A) {
                this.match.winner = 'B';
            } else {
                const set = this.getCurrentSet();
                this.match.winner = set.scoreA >= set.scoreB ? 'A' : 'B';
            }

            this.showSummary();
        }
    }

    showSummary() {
        this.showSection('summary-section');

        const winnerTeam = this.match.winner === 'A' ? this.match.teamA : this.match.teamB;
        const loserTeam = this.match.winner === 'A' ? this.match.teamB : this.match.teamA;

        // Match result
        document.getElementById('match-result').innerHTML = `
            <h2>🏆 ${winnerTeam.name}</h2>
            <p>defeats ${loserTeam.name}</p>
            <p style="margin-top:8px; color:#78909c;">
                Sets: ${this.match.setsWon.A} - ${this.match.setsWon.B} |
                Duration: ${this.getMatchDuration()}
            </p>
        `;

        // Set results
        let setResultsHTML = '<table><tr><th>Set</th><th>Team A</th><th>Team B</th></tr>';
        this.match.sets.forEach((set, i) => {
            setResultsHTML += `<tr>
                <td>Set ${i + 1}</td>
                <td>${set.scoreA}</td>
                <td>${set.scoreB}</td>
            </tr>`;
        });
        setResultsHTML += '</table>';
        document.getElementById('set-results').innerHTML = setResultsHTML;

        // Error summary
        const errorsA = this.match.allErrors.filter(e => e.team === 'A').length;
        const errorsB = this.match.allErrors.filter(e => e.team === 'B').length;
        document.getElementById('error-summary').innerHTML = `
            <table>
                <tr><th>Team</th><th>Total Errors</th></tr>
                <tr><td>${this.match.teamA.name}</td><td>${errorsA}</td></tr>
                <tr><td>${this.match.teamB.name}</td><td>${errorsB}</td></tr>
                <tr><td><strong>Total</strong></td><td><strong>${errorsA + errorsB}</strong></td></tr>
            </table>
        `;

        // Player error breakdown
        const playerErrorMap = {};
        this.match.allErrors.forEach(e => {
            if (!playerErrorMap[e.playerName]) {
                playerErrorMap[e.playerName] = 0;
            }
            playerErrorMap[e.playerName]++;
        });

        let playerErrorHTML = '<table><tr><th>Player</th><th>Errors</th></tr>';
        Object.entries(playerErrorMap)
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, count]) => {
                playerErrorHTML += `<tr><td>${name}</td><td>${count}</td></tr>`;
            });
        if (Object.keys(playerErrorMap).length === 0) {
            playerErrorHTML += '<tr><td colspan="2">No errors recorded</td></tr>';
        }
        playerErrorHTML += '</table>';
        document.getElementById('player-errors').innerHTML = playerErrorHTML;

        // Error types breakdown
        const errorTypeMap = {};
        this.match.allErrors.forEach(e => {
            if (!errorTypeMap[e.errorTypeLabel]) {
                errorTypeMap[e.errorTypeLabel] = 0;
            }
            errorTypeMap[e.errorTypeLabel]++;
        });

        let errorTypesHTML = '<table><tr><th>Error Type</th><th>Count</th></tr>';
        Object.entries(errorTypeMap)
            .sort((a, b) => b[1] - a[1])
            .forEach(([type, count]) => {
                errorTypesHTML += `<tr><td>${type}</td><td>${count}</td></tr>`;
            });
        if (Object.keys(errorTypeMap).length === 0) {
            errorTypesHTML += '<tr><td colspan="2">No errors recorded</td></tr>';
        }
        errorTypesHTML += '</table>';
        document.getElementById('error-types-summary').innerHTML = errorTypesHTML;
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

        let text = '';
        text += '═══════════════════════════════════════════\n';
        text += '       BADMINTON DOUBLES - MATCH SUMMARY\n';
        text += '═══════════════════════════════════════════\n';
        text += `Date: ${date}  |  Time: ${time}\n`;
        text += `Duration: ${this.getMatchDuration()}\n\n`;

        text += `🏆 WINNER: ${winnerTeam.name}\n`;
        text += `   defeated ${loserTeam.name}\n`;
        text += `   Sets: ${this.match.setsWon.A} - ${this.match.setsWon.B}\n\n`;

        text += '───────────────────────────────────────────\n';
        text += ' SET RESULTS\n';
        text += '───────────────────────────────────────────\n';
        text += `  ${'Set'.padEnd(8)}${'Team A'.padEnd(10)}Team B\n`;
        this.match.sets.forEach((set, i) => {
            text += `  ${('Set ' + (i + 1)).padEnd(8)}${String(set.scoreA).padEnd(10)}${set.scoreB}\n`;
        });

        text += '\n───────────────────────────────────────────\n';
        text += ' ERROR SUMMARY\n';
        text += '───────────────────────────────────────────\n';
        const errorsA = this.match.allErrors.filter(e => e.team === 'A').length;
        const errorsB = this.match.allErrors.filter(e => e.team === 'B').length;
        text += `  ${this.match.teamA.name}: ${errorsA} errors\n`;
        text += `  ${this.match.teamB.name}: ${errorsB} errors\n`;
        text += `  Total: ${errorsA + errorsB} errors\n`;

        // Player breakdown
        const playerErrorMap = {};
        this.match.allErrors.forEach(e => {
            if (!playerErrorMap[e.playerName]) playerErrorMap[e.playerName] = 0;
            playerErrorMap[e.playerName]++;
        });

        if (Object.keys(playerErrorMap).length > 0) {
            text += '\n  Player Breakdown:\n';
            Object.entries(playerErrorMap)
                .sort((a, b) => b[1] - a[1])
                .forEach(([name, count]) => {
                    text += `    ${name}: ${count}\n`;
                });
        }

        // Error types
        const errorTypeMap = {};
        this.match.allErrors.forEach(e => {
            if (!errorTypeMap[e.errorTypeLabel]) errorTypeMap[e.errorTypeLabel] = 0;
            errorTypeMap[e.errorTypeLabel]++;
        });

        if (Object.keys(errorTypeMap).length > 0) {
            text += '\n  Error Types:\n';
            Object.entries(errorTypeMap)
                .sort((a, b) => b[1] - a[1])
                .forEach(([type, count]) => {
                    text += `    ${type}: ${count}\n`;
                });
        }

        text += '\n═══════════════════════════════════════════\n';

        // Create and download the file
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `match-summary_${date.replace(/\//g, '-')}_${time.replace(/:/g, '')}.txt`;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    newMatch() {
        this.match = null;
        document.getElementById('teamA-player1').value = '';
        document.getElementById('teamA-player2').value = '';
        document.getElementById('teamB-player1').value = '';
        document.getElementById('teamB-player2').value = '';
        this.showSection('setup-section');
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        document.getElementById(sectionId).classList.remove('hidden');
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new BadmintonScoreSheet();
});
