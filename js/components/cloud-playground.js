class CloudPlayground {
    constructor(data) {
        this.data = data;
        this.mode = 'morning';
        this.currentIndex = 0;
        this.timelapseInterval = null;
        this.dayPlaybackInterval = null;
        this.specialDays = [5, 15, 25];
        this.dayTimeIndex = 0;
        this.speedMultiplier = 1; // Global Speed Multiplier

        // Elements
        this.els = {
            timeline: document.getElementById('cp-master-timeline'),
            cursor: document.getElementById('cp-cursor'),
            image: document.getElementById('cp-image'),
            imageCompare: document.getElementById('cp-image-compare'),
            imgContainer: document.getElementById('cp-img-container'),

            // Labels
            label: document.getElementById('overlay-label'),
            labelCompare: document.getElementById('overlay-label-compare'),

            dateDisplay: document.getElementById('cp-date-display'),
            moodDisplay: document.getElementById('cp-mood-display'),
            progressFill: document.getElementById('cp-progress-fill'),
            progressText: document.getElementById('cp-progress-text'),

            // Toggles
            btnMorning: document.getElementById('btn-morning'),
            btnAfternoon: document.getElementById('btn-afternoon'),
            btnCompare: document.getElementById('btn-compare'),
            btnDeepDive: document.getElementById('btn-deep-dive'),

            // Deep Dive
            deepDivePanel: document.getElementById('deep-dive-panel'),
            btnReplay: document.getElementById('btn-replay-day'),
            playbackSlider: document.getElementById('day-playback-slider'),

            guidance: document.getElementById('guidance-text')
        };

        this.renderTimeline();
        this.setupInteraction();
        this.setMode('morning');
    }

    setMode(m) {
        if (this.timelapseInterval) this.toggleTimelapse(); // Stop year loop
        if (this.dayPlaybackInterval) this.toggleDayPlayback(); // Stop day loop

        this.mode = m;

        // Update Buttons
        this.els.btnMorning.classList.toggle('active', m === 'morning');
        this.els.btnAfternoon.classList.toggle('active', m === 'afternoon');
        this.els.btnCompare.classList.toggle('active', m === 'compare');
        this.els.btnDeepDive.classList.toggle('active', m === 'deepdive');

        // Logic for Deep Dive Mode
        if (m === 'deepdive') {
            this.els.deepDivePanel.classList.remove('hidden');
            this.els.guidance.textContent = "Deep Dive Mode: Scrub to analyze hourly changes.";
            this.els.guidance.style.color = "#222";
        } else {
            this.els.deepDivePanel.classList.add('hidden');
            this.els.guidance.textContent = "Tip: Compare morning vs afternoon results.";
            this.els.guidance.style.color = "#666";
        }

        this.renderTimeline();
        this.updateView(this.currentIndex);
    }

    toggleDayPlayback() {
        if (this.dayPlaybackInterval) {
            clearInterval(this.dayPlaybackInterval);
            this.dayPlaybackInterval = null;
            document.getElementById('btn-replay-day').innerHTML = '▶ Replay Day';
        } else {
            // Stop timelapse
            if (this.timelapseInterval) this.toggleTimelapse();

            document.getElementById('btn-replay-day').innerHTML = '⏸ Pause';
            this.els.playbackSlider.disabled = false;
            this.els.playbackSlider.style.opacity = '1';

            this.dayTimeIndex = 0;

            // Base Deep Dive speed: 800ms
            const interval = 800 / this.speedMultiplier;

            this.dayPlaybackInterval = setInterval(() => {
                this.dayTimeIndex++;
                if (this.dayTimeIndex > 4) {
                    this.dayTimeIndex = 4;
                    this.toggleDayPlayback();
                    return;
                }
                this.els.playbackSlider.value = this.dayTimeIndex;
                this.updateDeepDiveView();
            }, interval);

            // Initial update
            this.els.playbackSlider.value = 0;
            this.updateDeepDiveView();
        }
    }

    toggleTimelapse() {
        if (this.timelapseInterval) {
            clearInterval(this.timelapseInterval);
            this.timelapseInterval = null;
            document.getElementById('btn-timelapse').innerHTML = '<span class="icon">▶</span> Play Year';
            document.getElementById('btn-timelapse').classList.remove('active');
        } else {
            // Stop other playbacks
            if (this.dayPlaybackInterval) this.toggleDayPlayback();

            document.getElementById('btn-timelapse').innerHTML = '<span class="icon">⏸</span> Pause';
            document.getElementById('btn-timelapse').classList.add('active');

            // Base timelapse speed: 100ms
            const interval = 100 / this.speedMultiplier;

            this.timelapseInterval = setInterval(() => {
                this.step(1, true); // Pass true to indicate auto-step
            }, interval);
        }
    }

    updateSpeed(val) {
        val = parseFloat(val);
        document.getElementById('speed-val').textContent = val + 'x';
        this.speedMultiplier = val;

        // Restart intervals if running to apply new speed
        if (this.timelapseInterval) {
            this.toggleTimelapse();
            this.toggleTimelapse();
        }
        if (this.dayPlaybackInterval) {
            this.toggleDayPlayback();
            this.toggleDayPlayback();
        }
    }

    handleDeepDiveScrub(val) {
        // Allow user to drag
        if (this.dayPlaybackInterval) this.toggleDayPlayback();
        this.dayTimeIndex = parseInt(val);
        this.updateDeepDiveView();
    }

    step(dir, isAuto = false) {
        // If manual click (isAuto is false), stop playback
        if (!isAuto && this.timelapseInterval) this.toggleTimelapse();

        let next = this.currentIndex + dir;
        if (next < 0) next = this.data.days.length - 1;
        if (next >= this.data.days.length) next = 0;

        // If in Deep Dive mode and stepping, we should probably reset to morning or stay in deep dive?
        // Let's stay in current mode, but update view.
        this.updateView(next);
    }

    jumpToNextSpecial() {
        if (this.timelapseInterval) this.toggleTimelapse();

        // Find next special day
        let nextIdx = -1;
        for (let i = this.currentIndex + 1; i < this.data.days.length; i++) {
            if (this.specialDays.includes(this.data.days[i].date.getDate())) {
                nextIdx = i;
                break;
            }
        }

        // Wrap around
        if (nextIdx === -1) {
            for (let i = 0; i <= this.currentIndex; i++) {
                if (this.specialDays.includes(this.data.days[i].date.getDate())) {
                    nextIdx = i;
                    break;
                }
            }
        }

        if (nextIdx !== -1) {
            this.currentIndex = nextIdx;
            // Auto-switch to deep dive mode
            this.setMode('deepdive');
        }
    }

    updateView(idx) {
        this.currentIndex = idx;
        const d = this.data.days[idx];
        const isSpecial = this.specialDays.includes(d.date.getDate());

        // Update Cursor
        const pct = (idx / 365) * 100;
        this.els.cursor.style.left = `${pct}%`;

        // Deep Dive Button Visibility
        if (isSpecial) {
            this.els.btnDeepDive.classList.remove('hidden');
            // If we are currently in deep dive mode, ensure panel is up
            if (this.mode === 'deepdive') {
                this.els.deepDivePanel.classList.remove('hidden');
                this.els.guidance.textContent = "Deep Dive Mode: Scrub to analyze hourly changes.";
                // If view changed while in deep dive, we might need to reset scrubber?
                // We'll leave scrubber as is for continuity if just stepping days (weird but ok).
            }
        } else {
            this.els.btnDeepDive.classList.add('hidden');
            // If we were in deep dive, force switch to morning
            if (this.mode === 'deepdive') {
                this.setMode('morning');
                return; // setMode calls updateView
            }
        }

        // Stats Logic
        let displayVal = "";
        let displayLabel = "";

        if (this.mode === 'compare') {
            displayLabel = "Cloud Burn-off (2pm - 8am)";
            const burnOff = (d.afternoon - d.morning) * 100;
            displayVal = (burnOff >= 0) ? `+${Math.round(burnOff)}%` : `${Math.round(burnOff)}%`;

            // Color Logic Matches Timeline: Diff > 0 = Blue, Diff <= 0 = Orange
            if (d.afternoon - d.morning > 0) {
                this.els.progressFill.style.backgroundColor = "#3498db";
            } else {
                this.els.progressFill.style.backgroundColor = "#e67e22";
            }
        } else if (this.mode === 'deepdive') {
            this.updateDeepDiveView();
            return;
        } else {
            displayLabel = (this.mode === 'morning') ? "08:00 AM" : "02:00 PM";
            const val = this.mode === 'afternoon' ? d.afternoon : d.morning;
            displayVal = `${Math.round(val * 100)}%`;

            // Color Logic Matches Timeline
            if (val < 0.4) {
                this.els.progressFill.style.backgroundColor = "#f1c40f"; // Yellow
            } else {
                this.els.progressFill.style.backgroundColor = "#bdc3c7"; // Grey
            }
        }

        const datePart = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        this.els.dateDisplay.innerHTML = `${datePart} <span style="font-weight:400; color:#ccc; font-size: 1rem;">|</span> <span style="font-size:0.9rem; color:#888;">${this.mode === 'compare' ? 'Difference (2pm - 8am)' : displayLabel}</span>`;

        // Update Bar Width based on magnitude
        let barW = 0;
        if (this.mode === 'compare') {
            barW = Math.abs(d.afternoon - d.morning) * 100;
        } else {
            barW = ((this.mode === 'afternoon') ? d.afternoon : d.morning) * 100;
        }
        this.els.progressFill.style.width = `${barW}%`;
        this.els.progressText.textContent = displayVal;

        // Mood
        const mVal = d.morning;
        this.els.moodDisplay.textContent = this.mode === 'compare' ? "Comparing Details" : (mVal < 0.2 ? "Clear Sky" : (mVal < 0.6 ? "Partly Cloudy" : "Overcast"));

        // Images Logic
        const yyyy = d.date.getFullYear();
        const mm = String(d.date.getMonth() + 1).padStart(2, '0');
        const days = String(d.date.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}${mm}${days}`;

        const pathMorning = `data/goes_images_monthly/${yyyy}-${mm}/${dateStr}_1602.webp`;
        const pathAfternoon = `data/goes_images_monthly/${yyyy}-${mm}/${dateStr}_2202.webp`;

        if (this.mode === 'compare') {
            this.els.image.src = pathMorning;
            this.els.imageCompare.src = pathAfternoon;

            this.els.image.style.width = "50%";
            this.els.imageCompare.classList.remove('hidden');
            this.els.imageCompare.style.width = "50%";

            // STRICT CSS POSITIONING for Labels
            this.els.label.textContent = "08:00 AM";
            this.els.label.style.left = "10px";
            this.els.label.style.right = "auto";

            this.els.labelCompare.textContent = "02:00 PM";
            this.els.labelCompare.classList.remove('hidden');
            this.els.labelCompare.style.left = "auto";
            this.els.labelCompare.style.right = "10px";

        } else {
            this.els.image.src = (this.mode === 'morning') ? pathMorning : pathAfternoon;
            this.els.image.style.width = "100%";
            this.els.imageCompare.classList.add('hidden');

            this.els.label.textContent = (this.mode === 'morning') ? "08:00 AM" : "02:00 PM";
            this.els.label.style.left = "10px";
            this.els.label.style.right = "auto";

            this.els.labelCompare.classList.add('hidden');
        }
    }

    updateDeepDiveView() {
        const d = this.data.days[this.currentIndex];

        // Map 0-4 to timecodes
        const codes = ['1402', '1602', '1802', '2002', '2202'];
        const times = ['06:00 AM', '08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM'];

        const code = codes[this.dayTimeIndex];
        const timeStr = times[this.dayTimeIndex];

        const yyyy = d.date.getFullYear();
        const mm = String(d.date.getMonth() + 1).padStart(2, '0');
        const days = String(d.date.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}${mm}${days}`;

        const path = `data/goes_images_selected/${dateStr}_${code}.webp`;

        this.els.image.src = path;
        this.els.image.style.width = "100%";
        this.els.imageCompare.classList.add('hidden');
        this.els.label.textContent = timeStr;

        // Updates Stats for Deep Dive
        const datePart = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        this.els.dateDisplay.innerHTML = `${datePart} <span style="font-weight:400; color:#ccc; font-size: 1rem;">|</span> <span style="font-size:0.9rem; color:#888;">${timeStr}</span>`;

        // Logic for Cloud Cover Value in Deep Dive
        // We only really have 8am (Index 1) and 2pm (Index 4) data points for cloud cover in the simple 'days' data.
        // d.morning -> 8am (Index 1)
        // d.afternoon -> 2pm (Index 4)
        // Others -> "--"

        let statText = "--";
        let barWidth = 0;

        if (this.dayTimeIndex === 1) { // 8am
            statText = `${Math.round(d.morning * 100)}%`;
            barWidth = d.morning * 100;
        } else if (this.dayTimeIndex === 4) { // 2pm
            statText = `${Math.round(d.afternoon * 100)}%`;
            barWidth = d.afternoon * 100;
        } else {
            // estimation or null? User asked for "--"
            statText = "--";
            barWidth = 0; // Empty bar or keep previous? Empty implies 'no data'
        }

        this.els.progressText.textContent = statText;
        this.els.progressFill.style.width = `${barWidth}%`;
    }

    findExtreme(type) {
        let targetIdx = 0;
        let diff = -1;
        this.data.days.forEach((d, i) => {
            const val = d.afternoon;
            if (type === 'cloudiest' && d.morning > diff) { diff = d.morning; targetIdx = i; }
            if (type === 'clearest' && (1 - d.afternoon) > diff) { diff = (1 - d.afternoon); targetIdx = i; }
            if (type === 'diff') {
                const delta = Math.abs(d.afternoon - d.morning);
                if (delta > diff) { diff = delta; targetIdx = i; }
            }
        });

        if (type === 'diff') {
            this.setMode('compare');
        } else {
            this.setMode((type === 'cloudiest') ? 'morning' : 'afternoon');
        }
        this.updateView(targetIdx);
    }

    setupInteraction() {
        this.els.timeline.onmousemove = (e) => {
            if (this.timelapseInterval || this.dayPlaybackInterval) return;
            const rect = this.els.timeline.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            const pct = Math.max(0, Math.min(1, x / width));
            const idx = Math.floor(pct * 364);
            this.updateView(idx);
        };
    }

    setMode(m) {
        if (this.timelapseInterval) this.toggleTimelapse();
        if (this.dayPlaybackInterval) this.toggleDayPlayback();

        this.mode = m;

        // Update Buttons
        this.els.btnMorning.classList.toggle('active', m === 'morning');
        this.els.btnAfternoon.classList.toggle('active', m === 'afternoon');
        this.els.btnCompare.classList.toggle('active', m === 'compare');
        this.els.btnDeepDive.classList.toggle('active', m === 'deepdive');

        if (m === 'deepdive') {
            this.els.deepDivePanel.classList.remove('hidden');
            this.els.guidance.textContent = "Deep Dive Mode: Scrub to analyze hourly changes.";
            this.els.guidance.style.color = "#222";
        } else {
            this.els.deepDivePanel.classList.add('hidden');
            this.els.guidance.textContent = "Tip: Compare morning vs afternoon results.";
            this.els.guidance.style.color = "#666";
        }

        // Re-render timeline to match mode
        this.renderTimeline();
        this.updateView(this.currentIndex);
    }

    renderTimeline() {
        this.els.timeline.querySelectorAll('.timeline-bar').forEach(e => e.remove());

        this.data.days.forEach((d, i) => {
            const bar = document.createElement('div');
            bar.className = 'timeline-bar';

            const isSpecial = this.specialDays.includes(d.date.getDate());
            if (isSpecial) {
                bar.classList.add('special-day-marker');
                bar.title = `Deep Dive Available: ${d.date.toLocaleDateString()}`;
            } else {
                bar.title = d.date.toLocaleDateString();
            }

            let val = 0;
            let finalColor = '#ccc';
            let heightPct = 100;

            if (this.mode === 'compare' || this.mode === 'deepdive') {
                // Difference Mode: 2pm - 8am
                val = d.afternoon - d.morning;
                heightPct = Math.abs(val) * 150; // Height based on magnitude

                if (val > 0) {
                    // Positive (Cleared up) -> Blue
                    finalColor = '#3498db';
                } else {
                    // Negative (Cloudier) -> Orange
                    finalColor = '#e67e22';
                }
            } else {
                // Absolute Mode
                val = (this.mode === 'afternoon') ? d.afternoon : d.morning;
                heightPct = (val * 100); // Height based on cloudiness

                if (val < 0.4) {
                    // Clear / Sunny -> Yellow (More visible)
                    finalColor = '#f1c40f';
                } else {
                    // Cloudy -> Grey (Clean grey)
                    finalColor = '#bdc3c7';
                }
            }

            bar.style.backgroundColor = finalColor;
            bar.style.height = `${heightPct}%`;
            this.els.timeline.appendChild(bar);
        });
    }
}
