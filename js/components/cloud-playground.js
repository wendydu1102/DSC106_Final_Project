class CloudPlayground {
    constructor(data) {
        this.data = data;
        this.time = 'morning'; // or afternoon
        this.mode = 'timeline'; // or extremes
        this.currentIndex = 0;

        // Elements
        this.els = {
            timeline: document.getElementById('cp-master-timeline'),
            cursor: document.getElementById('cp-cursor'),
            image: document.getElementById('cp-image'),
            dateDisplay: document.getElementById('cp-date-display'),
            moodDisplay: document.getElementById('cp-mood-display'),
            progressFill: document.getElementById('cp-progress-fill'),
            progressText: document.getElementById('cp-progress-text'),
            btnMorning: document.getElementById('btn-morning'),
            btnAfternoon: document.getElementById('btn-afternoon'),
            viewTimeline: document.getElementById('view-timeline'),
            viewExtremes: document.getElementById('view-extremes')
        };

        this.renderTimeline();
        this.setupInteraction();
        this.updateView(0); // Init
    }

    setTime(t) {
        this.time = t;
        this.els.btnMorning.classList.toggle('active', t === 'morning');
        this.els.btnAfternoon.classList.toggle('active', t === 'afternoon');
        this.updateView(this.currentIndex);
        this.renderTimeline(); // Re-color timeline
    }

    setMode(m) {
        this.mode = m;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
        this.els.viewTimeline.classList.toggle('hidden', m !== 'timeline');
        this.els.viewExtremes.classList.toggle('hidden', m !== 'extremes');
    }

    renderTimeline() {
        this.els.timeline.querySelectorAll('.timeline-bar').forEach(e => e.remove());

        this.data.days.forEach((d, i) => {
            const bar = document.createElement('div');
            bar.className = 'timeline-bar';

            // Color logic: Yellow if clear, Gray if cloudy
            const val = this.time === 'morning' ? d.morning : d.afternoon;
            // 0=Clear(Yellow), 1=Cloudy(Gray)
            const hue = val < 0.3 ? 48 : 200; // Yellow : BlueGray
            const sat = val < 0.3 ? 100 : (val * 10);
            const light = val < 0.3 ? 60 : (100 - val * 80);

            bar.style.backgroundColor = `hsl(${hue}, ${sat}%, ${light}%)`;
            bar.style.height = `${20 + (val * 80)}%`; // Cloudier = Taller bar

            // Interaction
            bar.onmouseenter = () => this.updateView(i);

            this.els.timeline.appendChild(bar);
        });
    }

    setupInteraction() {
        // Drag logic for cursor? For now just hover usage on timeline
        this.els.timeline.onmousemove = (e) => {
            const rect = this.els.timeline.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            const pct = Math.max(0, Math.min(1, x / width));
            const idx = Math.floor(pct * 364);
            this.updateView(idx);
        };
    }

    updateView(idx) {
        this.currentIndex = idx;
        const d = this.data.days[idx];

        // Update Cursor
        const pct = (idx / 365) * 100;
        this.els.cursor.style.left = `${pct}%`;

        // Update Stats
        const val = this.time === 'morning' ? d.morning : d.afternoon;
        const pctVal = Math.round(val * 100);

        this.els.dateDisplay.textContent = d.date.toLocaleDateString();
        this.els.moodDisplay.textContent = val < 0.2 ? "Clear Sky" : (val < 0.6 ? "Partly Cloudy" : "Overcast");
        this.els.progressFill.style.width = `${pctVal}%`;
        this.els.progressText.textContent = `${pctVal}%`;

        // Update Image
        // Path format: 2023-MM/2023MMDD_time.png
        // Time: Morning=1602, Afternoon=2202 (UTC approx for 8am/2pm PST)
        const yyyy = d.date.getFullYear();
        const mm = String(d.date.getMonth() + 1).padStart(2, '0');
        const days = String(d.date.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}${mm}${days}`;
        const timeCode = this.time === 'morning' ? '1602' : '2202';

        // Use placeholder if local not avail, but we have structure
        this.els.image.src = `data/goes_images_monthly/${yyyy}-${mm}/${dateStr}_${timeCode}.webp`;
    }

    findExtreme(type) {
        // Logic to find max/min
        let targetIdx = 0;
        let diff = -1;

        this.data.days.forEach((d, i) => {
            const val = this.time === 'morning' ? d.morning : d.afternoon;
            if (type === 'cloudiest' && val > diff) { diff = val; targetIdx = i; }
            if (type === 'clearest' && (1 - val) > diff) { diff = (1 - val); targetIdx = i; }
            if (type === 'random' && Math.random() > 0.99) targetIdx = i; // Quick hack
        });

        // Snap to it
        this.setTime(type === 'clearest' ? 'afternoon' : 'morning'); // Best guess context
        this.updateView(targetIdx);
    }
}
