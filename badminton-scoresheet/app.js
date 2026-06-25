// Badminton Doubles Score Sheet App - Enhanced Edition

class BadmintonScoreSheet {
    constructor() {
        this.match = null;
        this.STORAGE_KEY = 'badminton-player-names';
        this.HISTORY_KEY = 'badminton-match-history';
        this.THEME_KEY = 'badminton-theme';
        this.servingTeam = 'A';
        this.soundEnabled = true;
        this.initTheme();
        this.initVoice();
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

    // --- Voice Commands ---
    initVoice() {
        this.recognition = null;
        this.isListening = false;
        this.lastResultIndex = 0;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 3;

            this.recognition.onresult = (event) => {
                // Only process new results (avoid re-processing old ones)
                for (let i = this.lastResultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        const transcript = event.results[i][0].transcript.toLowerCase().trim();
                        const confidence = event.results[i][0].confidence;
                        this.processVoiceCommand(transcript, confidence);
                    }
                }
                this.lastResultIndex = event.results.length;
            };

            this.recognition.onend = () => {
                // Auto-restart if still in listening mode (keeps mic open)
                if (this.isListening) {
                    this.lastResultIndex = 0;
                    try { this.recognition.start(); } catch(e) {}
                } else {
                    document.getElementById('btn-voice-error').classList.remove('listening');
                    document.getElementById('btn-voice-error').textContent = '🎤 Voice Command';
                }
            };

            this.recognition.onerror = (event) => {
                if (event.error === 'no-speech' && this.isListening) return;
                if (event.error === 'aborted' && this.isListening) return;
                if (event.error === 'network') {
                    this.setVoiceStatus('Network error — check internet connection', 'error');
                    return;
                }
                this.isListening = false;
                document.getElementById('btn-voice-error').classList.remove('listening');
                document.getElementById('btn-voice-error').textContent = '🎤 Voice Command';
                this.setVoiceStatus(`Error: ${event.error}`, 'error');
            };
        }
    }

    toggleVoice() {
        if (!this.recognition) {
            this.setVoiceStatus('Speech recognition not supported in this browser', 'error');
            return;
        }
        if (!this.match) {
            this.setVoiceStatus('Start a match first before using voice commands', 'error');
            return;
        }
        if (this.isListening) {
            this.isListening = false;
            this.recognition.stop();
            document.getElementById('btn-voice-error').classList.remove('listening');
            document.getElementById('btn-voice-error').textContent = '🎤 Voice Command';
            document.getElementById('voice-help').classList.add('hidden');
            this.setVoiceStatus('Voice stopped', '');
        } else {
            this.lastResultIndex = 0;
            this.recognition.start();
            this.isListening = true;
            document.getElementById('btn-voice-error').classList.add('listening');
            document.getElementById('btn-voice-error').textContent = '⏹ Listening (tap to stop)';
            document.getElementById('voice-help').classList.remove('hidden');
            this.setVoiceStatus('Listening continuously... speak anytime', '');
        }
    }

    setVoiceStatus(msg, type) {
        const el = document.getElementById('voice-status');
        el.textContent = msg;
        el.className = 'voice-status' + (type ? ' ' + type : '');
        if (type) setTimeout(() => { el.textContent = ''; el.className = 'voice-status'; }, 4000);
    }

    processVoiceCommand(transcript, confidence) {
        this.setVoiceStatus(`Heard: "${transcript}" (${Math.round(confidence * 100)}%)`, '');

        if (!this.match || this.match.isFinished) {
            this.setVoiceStatus('No active match', 'error');
            return;
        }

        // Check for point commands: "point A", "point B", "score A", "score B"
        const pointMatch = transcript.match(/\b(point|score)\s*(a|b|team\s*a|team\s*b)\b/i);
        if (pointMatch) {
            const team = pointMatch[2].includes('a') ? 'A' : 'B';
            this.addPoint(team);
            this.setVoiceStatus(`✓ Point awarded to Team ${team}`, 'success');
            return;
        }

        // Quick shortcodes: A1, A2, B1, B2 + error type
        let team = null;
        let playerIndex = 0;
        let matchedPlayerName = null;

        // Match shortcodes like "a1", "a 1", "a one", "b2", "b two"
        const shortcodeMatch = transcript.match(/\b(a|b)\s*(1|2|one|two|won)\b/i);
        if (shortcodeMatch) {
            const teamLetter = shortcodeMatch[1].toLowerCase();
            const playerNum = shortcodeMatch[2];
            team = teamLetter === 'a' ? 'A' : 'B';
            playerIndex = (playerNum === '2' || playerNum === 'two') ? 1 : 0;
            const teamObj = team === 'A' ? this.match.teamA : this.match.teamB;
            matchedPlayerName = teamObj.players[playerIndex];
        }

        // Try to detect player name from transcript to auto-identify team (only if shortcode didn't match)
        if (!matchedPlayerName && this.match) {
            const allPlayers = [
                { name: this.match.teamA.players[0], team: 'A', index: 0 },
                { name: this.match.teamA.players[1], team: 'A', index: 1 },
                { name: this.match.teamB.players[0], team: 'B', index: 0 },
                { name: this.match.teamB.players[1], team: 'B', index: 1 }
            ];

            // Sort by name length descending to match longer names first
            allPlayers.sort((a, b) => b.name.length - a.name.length);

            // First pass: try full name match
            for (const p of allPlayers) {
                if (p.name && transcript.includes(p.name.toLowerCase())) {
                    team = p.team;
                    playerIndex = p.index;
                    matchedPlayerName = p.name;
                    break;
                }
            }

            // Second pass: try matching individual words in player names (first name or last name)
            if (!matchedPlayerName) {
                for (const p of allPlayers) {
                    if (!p.name) continue;
                    const nameParts = p.name.toLowerCase().split(/\s+/);
                    for (const part of nameParts) {
                        if (part.length >= 3 && transcript.includes(part)) {
                            team = p.team;
                            playerIndex = p.index;
                            matchedPlayerName = p.name;
                            break;
                        }
                    }
                    if (matchedPlayerName) break;
                }
            }
        }

        // Fallback: try explicit team mention if player name didn't match
        if (!team) {
            if (transcript.includes('team a')) team = 'A';
            else if (transcript.includes('team b')) team = 'B';
        }

        if (!team) {
            this.setVoiceStatus('❌ Not recognized. Try: "A1 net", "B2 out", or player name', 'error');
            return;
        }

        // Detect error type — ordered from most specific to least to avoid false matches
        const errorMap = [
            { key: 'service', keywords: ['service fault', 'serve fault', 'service', 'serve'] },
            { key: 'net', keywords: ['net fault', 'net'] },
            { key: 'double-hit', keywords: ['double hit', 'double'] },
            { key: 'unforced', keywords: ['unforced error', 'unforced'] },
            { key: 'out', keywords: ['shot out', ' out', 'out '] },
            { key: 'carry', keywords: ['carry', 'sling'] },
            { key: 'obstruction', keywords: ['obstruction', 'block'] },
            { key: 'other', keywords: ['fault', 'error', 'other'] }
        ];

        let detectedError = 'other';
        let detectedErrorLabel = 'Other';
        for (const entry of errorMap) {
            let found = false;
            for (const kw of entry.keywords) {
                if (transcript.includes(kw.trim())) {
                    detectedError = entry.key;
                    const opt = document.querySelector(`#error-type option[value="${entry.key}"]`);
                    detectedErrorLabel = opt ? opt.text : entry.key;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        // If team was found by explicit mention but player wasn't matched by name, check for "player 2"
        if (!matchedPlayerName) {
            const teamObj = team === 'A' ? this.match.teamA : this.match.teamB;
            if (transcript.includes('player 2') || transcript.includes('player two')) {
                playerIndex = 1;
            }
            matchedPlayerName = teamObj.players[playerIndex];
        }

        // Record error directly without relying on dropdowns
        this.recordErrorDirect(team, playerIndex, detectedError, detectedErrorLabel);

        // Also sync the dropdowns visually
        const teamSelect = document.getElementById('error-team');
        teamSelect.value = team;
        teamSelect.dispatchEvent(new Event('change'));
        document.getElementById('error-player').value = String(playerIndex + 1);
        document.getElementById('error-type').value = detectedError;

        this.setVoiceStatus(`✓ ${detectedErrorLabel} by ${matchedPlayerName} (Team ${team})`, 'success');
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
        document.getElementById('btn-voice-error').addEventListener('click', () => this.toggleVoice());

        // Quick error buttons
        document.querySelectorAll('.btn-quick-error').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const team = e.target.dataset.team;
                const playerIdx = parseInt(e.target.dataset.player);
                const errorType = document.getElementById('quick-error-type').value;
                const errorTypeLabel = document.getElementById('quick-error-type').selectedOptions[0].text;
                this.recordErrorDirect(team, playerIdx, errorType, errorTypeLabel);
            });
        });
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
        document.getElementById('btn-select-all-history').addEventListener('click', () => this.toggleSelectAllHistory());
        document.getElementById('btn-export-history').addEventListener('click', () => this.exportSelectedHistory());
        document.getElementById('btn-import-history').addEventListener('change', (e) => this.importHistory(e));
        document.getElementById('btn-leaderboard-filter').addEventListener('click', () => this.renderLeaderboard());
        document.getElementById('btn-leaderboard-clear').addEventListener('click', () => this.clearLeaderboardFilters());

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
        this.updateQuickErrorLabels();
        this.updateServiceDisplay();
        this.showSection('scoreboard-section');
        this.updateDisplay();
    }

    updateErrorPlayerOptions() {
        const teamSelect = document.getElementById('error-team');
        const playerSelect = document.getElementById('error-player');

        // Remove previous listener if exists
        if (this._errorTeamChangeHandler) {
            teamSelect.removeEventListener('change', this._errorTeamChangeHandler);
        }

        this._errorTeamChangeHandler = () => {
            const team = teamSelect.value === 'A' ? this.match.teamA : this.match.teamB;
            playerSelect.innerHTML = `
                <option value="1">${team.players[0]}</option>
                <option value="2">${team.players[1]}</option>`;
        };

        teamSelect.addEventListener('change', this._errorTeamChangeHandler);
        this._errorTeamChangeHandler();
    }

    updateQuickErrorLabels() {
        const namesEl = document.getElementById('quick-error-names');
        if (this.match) {
            namesEl.innerHTML = `<span class="qe-label-a"><strong>A1:</strong> ${this.match.teamA.players[0]}</span> &nbsp;|&nbsp; <span class="qe-label-a"><strong>A2:</strong> ${this.match.teamA.players[1]}</span> &nbsp;|&nbsp; <span class="qe-label-b"><strong>B1:</strong> ${this.match.teamB.players[0]}</span> &nbsp;|&nbsp; <span class="qe-label-b"><strong>B2:</strong> ${this.match.teamB.players[1]}</span>`;
        }
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
        this.recordErrorDirect(team, playerIndex, errorType, errorTypeLabel);
    }

    recordErrorDirect(team, playerIndex, errorType, errorTypeLabel) {
        if (this.match.isFinished) return;
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
                <div class="history-item-header">
                    <label class="history-checkbox"><input type="checkbox" class="match-select" data-id="${m.id}"></label>
                    <div class="match-date">${date} ${time} | Duration: ${m.duration}</div>
                    <button class="btn-delete-match" data-id="${m.id}" title="Delete this match">✕</button>
                </div>
                <div class="match-teams">${m.teamA.name} vs ${m.teamB.name}</div>
                <div class="match-score">Sets: ${m.setsWon.A}-${m.setsWon.B} (${scores})</div>
                <div class="match-winner">🏆 Winner: ${winnerName}</div>
            </div>`;
        }).join('');

        // Attach delete handlers
        container.querySelectorAll('.btn-delete-match').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(e.target.dataset.id);
                this.deleteMatchFromHistory(id);
            });
        });
    }

    deleteMatchFromHistory(id) {
        if (!confirm('Delete this match from history?')) return;
        let history = this.getMatchHistory();
        history = history.filter(m => m.id !== id);
        localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
        this.renderHistoryPage();
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

    toggleSelectAllHistory() {
        const checkboxes = document.querySelectorAll('.match-select');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
    }

    exportSelectedHistory() {
        const selectedIds = Array.from(document.querySelectorAll('.match-select:checked'))
            .map(cb => parseInt(cb.dataset.id));

        if (selectedIds.length === 0) {
            alert('Please select at least one match to export.');
            return;
        }

        const history = this.getMatchHistory();
        const selected = history.filter(m => selectedIds.includes(m.id));

        const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `badminton-history_${date}_${selected.length}matches.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importHistory(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) {
                    alert('Invalid file format. Expected a JSON array of matches.');
                    return;
                }

                const history = this.getMatchHistory();
                const existingIds = new Set(history.map(m => m.id));
                let added = 0;

                imported.forEach(m => {
                    if (!existingIds.has(m.id)) {
                        history.push(m);
                        added++;
                    }
                });

                // Sort by date descending
                history.sort((a, b) => new Date(b.date) - new Date(a.date));
                localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
                this.renderHistoryPage();
                alert(`Imported ${added} new match(es). ${imported.length - added} duplicate(s) skipped.`);
            } catch (err) {
                alert('Error reading file. Please ensure it is a valid JSON export.');
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be imported again
        event.target.value = '';
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
        const fromDate = document.getElementById('leaderboard-from').value;
        const toDate = document.getElementById('leaderboard-to').value;

        const filtered = history.filter(m => {
            const matchDate = m.date.split('T')[0];
            if (fromDate && matchDate < fromDate) return false;
            if (toDate && matchDate > toDate) return false;
            return true;
        });

        const playerStats = {};

        filtered.forEach(m => {
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
        const dateInfo = (fromDate || toDate) ? `<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:12px;">Showing: ${fromDate || 'start'} → ${toDate || 'now'} (${filtered.length} matches)</p>` : '';

        if (sorted.length === 0) {
            container.innerHTML = dateInfo + '<p style="text-align:center; color:var(--text-muted); padding:40px;">No match data found for this date range.</p>';
            return;
        }

        let html = dateInfo + `<table>
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

    clearLeaderboardFilters() {
        document.getElementById('leaderboard-from').value = '';
        document.getElementById('leaderboard-to').value = '';
        this.renderLeaderboard();
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
