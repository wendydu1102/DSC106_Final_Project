// --- CONFIG ---
const CONFIG = {
    // Mapbox Token
    mapboxToken: 'pk.eyJ1IjoiY2hzMDE5IiwiYSI6ImNtaHpwN25rNzBldmsya3E1NmFidG5icTkifQ.GzhjSurtv5YaKV27YtvW9Q'
};

// --- SECTION 1: HERO GRID ---
class HeroGrid {
    constructor() {
        this.container = document.getElementById('hero-grid-bg');
        this.init();
    }

    init() {
        if (!this.container) return;
        this.container.innerHTML = ''; // Clear existing

        // We have GOES_IMAGES global from data/goes_images_index.js
        if (typeof GOES_IMAGES === 'undefined') {
            console.warn("HeroGrid: GOES_IMAGES data not found.");
            // Fallback to simple grid?
            return;
        }

        // Flatten all images into a single list
        const days = [];
        const months = Object.keys(GOES_IMAGES.goesImages).sort();

        months.forEach(mKey => {
            const monthData = GOES_IMAGES.goesImages[mKey];
            const imageKeys = Object.keys(monthData).sort();

            // Filter for Morning (1602) images only to keep it clean, 
            // or use all? Using morning is consistent with "The Gray Truth"
            imageKeys.forEach(k => {
                if (k.includes('1602')) {
                    days.push(monthData[k]);
                }
            });
        });

        // Limit to reasonable number for performance if needed, but 365 is fine.
        // Create cells
        days.forEach((path, i) => {
            const cell = document.createElement('div');
            cell.className = 'hero-cell';
            // Path adjustment: App is in /final/, data is in /data/
            // The JSON paths are "data/goes_images_monthly/2023-XX/image.webp"

            // Go up one level from /final/ to root
            const relPath = `${path}`;

            cell.style.backgroundImage = `url('${relPath}')`;

            // Staggered animation on load
            cell.style.opacity = 0;
            setTimeout(() => {
                cell.style.opacity = 0.8;
            }, i * 5); // Fast ripple

            this.container.appendChild(cell);
        });
    }
}

// --- DATASET PROCESSOR (Real Data) ---
class Dataset {
    constructor(rawData) {
        this.raw = rawData;
        this.process();
    }

    process() {
        // 1. Calculate Regional Monthly Means from 'socal_cloudmap_monthly'
        // This gives us the "Real Seasonality" curve
        const monthlyStats = {}; // { 1: {cloud, temp, sun}, 2: ... }

        if (this.raw.socal_cloudmap_monthly) {
            this.raw.socal_cloudmap_monthly.forEach(record => {
                const m = record.month;
                if (!monthlyStats[m]) monthlyStats[m] = { c: [], t: [], s: [] };
                monthlyStats[m].c.push(record.clt);
                monthlyStats[m].t.push(record.tas);
                monthlyStats[m].s.push(record.rsds);
            });
        }

        // Average them out
        const regionalMeans = [];
        for (let m = 1; m <= 12; m++) {
            if (monthlyStats[m]) {
                const c = monthlyStats[m].c.reduce((a, b) => a + b, 0) / monthlyStats[m].c.length;
                const t = monthlyStats[m].t.reduce((a, b) => a + b, 0) / monthlyStats[m].t.length;
                const s = monthlyStats[m].s.reduce((a, b) => a + b, 0) / monthlyStats[m].s.length;
                // Convert units:
                // CLT is %, TAS is Kelvin, RSDS is W/m2
                regionalMeans[m] = {
                    cloud: c / 100, // 0-1
                    temp: (t - 273.15) * 9 / 5 + 32, // K -> F
                    solar: s / 300 // Normalize approx max 300?
                };
            } else {
                regionalMeans[m] = { cloud: 0.5, temp: 70, solar: 0.5 }; // Fallback
            }
        }

        // 2. Synthesize Daily Data for Calendar/Lab components based on Real Means
        // We synthesize 365 days that statistically match the monthly means
        this.days = [];
        const startDate = new Date(2023, 0, 1);

        for (let i = 0; i < 365; i++) {
            const current = new Date(startDate);
            current.setDate(startDate.getDate() + i);
            const m = current.getMonth() + 1;
            const stats = regionalMeans[m];

            // Add slight daily noise
            const noise = () => (Math.random() - 0.5) * 0.2;

            // Morning vs Afternoon Bias (Gloom logic)
            // May/June (5,6) have high morning cloud, low afternoon
            let amCloud = stats.cloud + noise();
            let pmCloud = stats.cloud + noise();

            if (m === 5 || m === 6) {
                amCloud += 0.3; // Boost morning gloom
                pmCloud -= 0.1; // Burn off
            }

            // Clamp
            amCloud = Math.max(0, Math.min(1, amCloud));
            pmCloud = Math.max(0, Math.min(1, pmCloud));

            this.days.push({
                date: current,
                month: m,
                morning: amCloud,
                afternoon: pmCloud,
                temp: stats.temp + (noise() * 10),
                solar: stats.solar + noise()
            });
        }

        // 3. Process Cities for Ranking (Real Data)
        this.cities = {};
        if (this.raw.city_sunnyscore) {
            this.raw.city_sunnyscore.forEach(c => {
                this.cities[c.city] = {
                    name: c.city,
                    lat: c.lat,
                    lon: c.lon,
                    // Store stats normalized
                    stats: {
                        avgCloud: c.clt / 100,
                        avgTemp: (c.tas - 273.15) * 9 / 5 + 32,
                        avgSun: c.rsds / 300 // approx norm
                    },
                    // Link synthesized days for visuals (shared regional weather for demo)
                    days: this.days
                };
            });
        }
        // Fallback for visual components if they look for 'Santa Monica' specifically
        if (!this.cities['Santa Monica']) {
            // Use 1st avail
            const first = Object.values(this.cities)[0];
            if (first) this.cities['Santa Monica'] = first;
        }
    }
}

// --- SECTION 2: CLOUD WALL ---
class CloudWall {
    constructor(data) {
        this.data = data;
        this.container = document.getElementById('cloud-cal-grid');
        this.viewMode = 'both';

        // Create Tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'cal-sat-preview';
        this.tooltip.innerHTML = '<span>Jan 1</span>';
        document.body.appendChild(this.tooltip);

        this.render();
        this.setupScroll();
        this.setupControls();

        // Init View
        this.setView('both');
    }

    render() {
        this.container.innerHTML = '';
        this.data.days.forEach((d, i) => {
            const cell = document.createElement('div');
            cell.className = 'cal-cell';

            // Create Layers
            const am = document.createElement('div');
            am.className = 'am-layer';
            this.setLayerColor(am, d.morning);
            // Bind Context
            am.onmouseenter = (e) => this.showPreview(d, 'morning', e);
            am.onmousemove = (e) => this.movePreview(e);
            am.onmouseleave = () => this.hidePreview();

            const pm = document.createElement('div');
            pm.className = 'pm-layer';
            this.setLayerColor(pm, d.afternoon);
            // Bind Context
            pm.onmouseenter = (e) => this.showPreview(d, 'afternoon', e);
            pm.onmousemove = (e) => this.movePreview(e);
            pm.onmouseleave = () => this.hidePreview();

            cell.appendChild(am);
            cell.appendChild(pm);
            this.container.appendChild(cell);
        });
    }

    setupControls() {
        // Buttons handled inline via onclick="app.cloudWall.setView('...')"
    }

    setView(mode) {
        this.viewMode = mode;

        // 1. Update Container Class for CSS Logic (Square vs Split)
        this.container.className = `view-${mode}`;

        // 2. Update Buttons UI
        document.querySelectorAll('.viz-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });
    }

    showPreview(d, context, e) {
        const yyyy = d.date.getFullYear();
        const mm = String(d.date.getMonth() + 1).padStart(2, '0');
        const days = String(d.date.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}${mm}${days}`;

        // Context passed explicitly from the hovered layer
        const timeCode = context === 'morning' ? '1602' : '2202';
        const label = context === 'morning' ? 'Morning' : 'Afternoon';

        // Value for Percentage
        const val = context === 'morning' ? d.morning : d.afternoon;
        const pct = Math.round(val * 100);

        const imgPath = `data/goes_images_monthly/${yyyy}-${mm}/${dateStr}_${timeCode}.webp`;

        this.tooltip.style.backgroundImage = `url(${imgPath})`;
        this.tooltip.querySelector('span').textContent = `${d.date.toLocaleDateString()} (${label}): ${pct}% Cloud`;
        this.tooltip.style.opacity = 1;
        this.movePreview(e);
    }

    movePreview(e) {
        this.tooltip.style.left = `${e.pageX + 15}px`;
        this.tooltip.style.top = `${e.pageY + 15}px`;
    }

    hidePreview() {
        this.tooltip.style.opacity = 0;
    }

    setLayerColor(el, cloudiness) {
        const lightness = 95 - (cloudiness * 60);
        const sat = (1 - cloudiness) * 90;
        el.style.backgroundColor = `hsl(48, ${sat}%, ${lightness}%)`;
    }

    setupScroll() {
        const steps = document.querySelectorAll('.step');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const step = entry.target.dataset.step;
                    this.updateState(step);
                    document.querySelectorAll('.step-content').forEach(s => s.style.opacity = 0.2);
                    entry.target.querySelector('.step-content').style.opacity = 1;
                }
            });
        }, { threshold: 0.6 });

        steps.forEach(s => observer.observe(s));
    }

    updateState(step) {
        // Manage focus via ViewMode based on story
        const cells = document.querySelectorAll('.cal-cell');

        // Logic Mapping
        if (step === '5' || step === '6') {
            this.setView('afternoon');
        } else if (step === '7') {
            this.setView('both');
        } else {
            // Default Morning (1-4)
            this.setView('morning');
        }

        // Highlight Logic (Scaling/Z-Index)
        this.data.days.forEach((d, i) => {
            const cell = cells[i];
            cell.style.transform = 'scale(1)';
            cell.style.zIndex = 1;
            cell.style.boxShadow = 'none';

            let highlight = false;
            if (step == '2' && d.month <= 2) highlight = true;
            if (step == '3' && d.month === 4) highlight = true;
            if (step == '4' && d.month === 5) highlight = true;
            if (step == '6' && (d.month === 8 || d.month === 9)) highlight = true;

            if (highlight) {
                cell.style.transform = 'scale(1.2)';
                cell.style.zIndex = 10;
                cell.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
            }
        });
    }
}

// --- SECTION 3: CLOUD PLAYGROUND ---
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

// --- SECTION 3: GLOOM SCATTER ---
class GloomScatter {
    constructor(data) {
        this.data = data;
        this.container = document.getElementById('gloom-scatter');
        this.activeFilter = 'gloom';
        this.render();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const cityData = this.data.cities['Santa Monica'] || Object.values(this.data.cities)[0];
        if (!cityData) return;

        cityData.days.forEach(d => {
            const dot = document.createElement('div');
            dot.className = 'scatter-dot';

            // X = Temp (50-95 range)
            const tempPct = (d.temp - 50) / (95 - 50) * 100;

            // Y = Cloud Cover (morning cloudiness, top = cloudy, bottom = clear)
            dot.style.left = `${Math.max(0, Math.min(100, tempPct))}%`;
            dot.style.top = `${d.morning * 100}%`;
            dot.style.backgroundColor = this.getColor(d);
            dot.dataset.month = d.month;

            this.container.appendChild(dot);
        });

        this.filter(this.activeFilter);
    }

    getColor(d) {
        if (d.month <= 3) return '#3498db';       // Winter: Blue
        if (d.month <= 6) return '#95a5a6';       // Spring/Gloom: Gray
        if (d.month >= 8 && d.month <= 10) return '#f39c12'; // Summer: Orange
        return '#7f8c8d';                         // Fall: Gray
    }

    filter(mode) {
        this.activeFilter = mode;
        const dots = this.container.querySelectorAll('.scatter-dot');

        // Update button active states
        document.querySelectorAll('.gloom-btn').forEach(btn => {
            const btnText = btn.textContent.toLowerCase();
            const isActive =
                (mode === 'winter' && btnText.includes('winter')) ||
                (mode === 'gloom' && btnText.includes('gloom')) ||
                (mode === 'summer' && btnText.includes('true summer')) ||
                (mode === 'all' && btnText.includes('all'));

            btn.classList.toggle('active', isActive);
        });

        // Filter dots
        dots.forEach(dot => {
            const m = parseInt(dot.dataset.month);
            let show = false;

            if (mode === 'all') show = true;
            else if (mode === 'winter' && (m >= 1 && m <= 3)) show = true;
            else if (mode === 'gloom' && (m >= 5 && m <= 6)) show = true;
            else if (mode === 'summer' && (m >= 8 && m <= 10)) show = true;

            dot.style.opacity = show ? 0.8 : 0.05;
            dot.style.transform = show ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.5)';
        });
    }
}

// --- SECTION 4: CLIMATE LAB ---
class ClimateLab {
    constructor(data) {
        this.data = data;
        this.variable = 'clouds'; // clouds, temp, sun
        this.container = document.getElementById('lab-colorfield');
        // Create Tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'val-tooltip'; // Reusing or creating new generic class
        this.tooltip.style.opacity = 0;
        this.tooltip.style.position = 'absolute';
        this.tooltip.style.pointerEvents = 'none';
        this.tooltip.style.zIndex = '1000';
        document.body.appendChild(this.tooltip);

        this.render();
    }

    setVariable(v) {
        this.variable = v;
        document.querySelectorAll('.var-btn').forEach(b => {
            b.classList.toggle('active', b.textContent.toLowerCase().includes(v === 'clouds' ? 'cloud' : v));
        });

        const insights = {
            'clouds': 'Data Insight: Cloud cover peaks in late spring (May/June), creating a disconnect with rising solar angles.',
            'temp': 'Data Insight: Temperature lags behind the sun. The ocean keeps coastal cities cool until August/September.',
            'sun': 'Data Insight: Solar Radiation is purely geometric. It peaks in June, exactly when the clouds are thickest.'
        };
        const insightEl = document.getElementById('lab-insight');
        if (insightEl) insightEl.textContent = insights[v];

        this.render();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        // Use Santa Monica as proxy for regional seasonality
        let cityData = this.data.cities['Santa Monica'];
        if (!cityData) {
            // Try to find any city
            const keys = Object.keys(this.data.cities);
            if (keys.length > 0) cityData = this.data.cities[keys[0]];
        }

        if (!cityData) {
            console.warn("ClimateLab: No city data available to render.");
            this.container.innerHTML = '<div style="padding:2rem; color:#999; text-align:center;">Loading Data...</div>';
            return;
        }

        const days = cityData.days;
        const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

        for (let m = 1; m <= 12; m++) {
            const row = document.createElement('div');
            row.className = 'lab-month-row';

            const label = document.createElement('div');
            label.className = 'month-label';
            label.textContent = months[m - 1];
            row.appendChild(label);

            const cellContainer = document.createElement('div');
            cellContainer.className = 'lab-row-cells';
            row.appendChild(cellContainer);

            const monthDays = days.filter(d => d.date.getMonth() + 1 === m);

            monthDays.forEach(d => {
                const cell = document.createElement('div');
                cell.className = 'lab-cell';
                cell.style.backgroundColor = this.getCellColor(d);
                // Custom Tooltip Data
                cell.onmouseenter = (e) => this.showTooltip(e, d);
                cell.onmousemove = (e) => this.moveTooltip(e);
                cell.onmouseleave = () => this.hideTooltip();

                cellContainer.appendChild(cell);
            });
            this.container.appendChild(row);
        }

        this.renderSparklines();
    }

    showTooltip(e, d) {
        const val = this.getTooltipVal(d);
        this.tooltip.innerHTML = `<strong>${d.date.toLocaleDateString()}</strong><br>${val}`;
        this.tooltip.style.opacity = 1;
        this.moveTooltip(e);
    }

    moveTooltip(e) {
        this.tooltip.style.left = `${e.pageX + 10}px`;
        this.tooltip.style.top = `${e.pageY + 10}px`;
    }

    hideTooltip() {
        this.tooltip.style.opacity = 0;
    }

    getCellColor(d) {
        if (this.variable === 'clouds') {
            const v = d.morning;
            const sat = 80 - (v * 70);
            const light = 60 + (v * 30);
            return `hsl(210, ${sat}%, ${light}%)`;
        } else if (this.variable === 'temp') {
            // Cold(50) -> Hot(90)
            // Blue(240) -> Red(0)
            const t = d.temp;
            let hue = 240 - ((t - 55) / 35 * 240); // Map 55-90 to 240-0
            hue = Math.max(0, Math.min(240, hue));
            return `hsl(${hue}, 70%, 50%)`;
        } else {
            // Sun: Black(0) -> Yellow(1)
            const s = d.solar;
            return `hsl(48, 100%, ${s * 50}%)`;
        }
    }

    getTooltipVal(d) {
        if (this.variable === 'clouds') return `${Math.round(d.morning * 100)}% Cloud`;
        if (this.variable === 'temp') return `${Math.round(d.temp)}°F`;
        return `Solar Index ${d.solar.toFixed(2)}`;
    }

    renderSparklines() {
        const container = document.getElementById('season-sparklines');
        if (!container) return;
        container.className = 'season-sparkline-container';
        container.innerHTML = '';

        // Calculate Monthly Averages
        const cityData = this.data.cities['Santa Monica'] || Object.values(this.data.cities)[0];
        const monthlyAvgs = [];

        for (let m = 1; m <= 12; m++) {
            const days = cityData.days.filter(d => d.date.getMonth() + 1 === m);
            const sum = days.reduce((acc, d) => {
                if (this.variable === 'clouds') return acc + d.morning;
                if (this.variable === 'temp') return acc + d.temp;
                return acc + d.solar;
            }, 0);
            monthlyAvgs.push(sum / days.length);
        }

        // Find Range for styling
        const max = Math.max(...monthlyAvgs);
        const min = Math.min(...monthlyAvgs); // Base bars from 0 or min? using 0 for scale is safer

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        monthlyAvgs.forEach((val, i) => {
            const bar = document.createElement('div');
            bar.className = 'spark-bar';

            // Normalize Height (relative to realistic max for type?)
            // To make it look good, let's normalize to the local dataset max
            let pct = (val / max) * 100;
            if (this.variable === 'temp') pct = ((val - 40) / (90 - 40)) * 100; // Custom scale for temp visibility

            bar.style.height = `${Math.max(5, pct)}%`;

            // Color logic: simply use the representative color for that average value
            // Mock a day object to reuse getCellColor
            const dummyDay = { morning: val, temp: val, solar: val };
            bar.style.backgroundColor = this.getCellColor(dummyDay);

            // Tooltip
            const displayVal = this.variable === 'clouds' ? `${Math.round(val * 100)}%` :
                (this.variable === 'temp' ? `${Math.round(val)}°F` : val.toFixed(2));
            bar.setAttribute('data-val', `${months[i]}: ${displayVal}`);

            container.appendChild(bar);
        });
    }
}

// --- SECTION 5: CITY PLAYGROUND (MAPBOX) ---
class CityRanker {
    constructor(data) {
        this.data = data;
        this.weights = { sun: 50, cloud: 70, heat: 30 };
        this.listContainer = document.getElementById('city-list');

        mapboxgl.accessToken = CONFIG.mapboxToken;
        this.map = new mapboxgl.Map({
            container: 'city-map-container',
            style: 'mapbox://styles/mapbox/light-v10',
            center: [-118.5, 33.8],
            zoom: 7,
            scrollZoom: false
        });

        this.map.on('load', () => this.initMap());

        this.popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15
        });
    }

    initMap() {
        this.map.resize();

        this.map.addSource('cities', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        this.map.addLayer({
            id: 'cities-layer',
            type: 'circle',
            source: 'cities',
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'score'],
                    0, 4,
                    100, 8,
                    300, 20
                ],
                'circle-color': [
                    'case',
                    ['<=', ['get', 'rank'], 3], '#f4d03f',
                    '#2c3e50'
                ],
                'circle-opacity': 0.8,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        this.map.on('mouseenter', 'cities-layer', (e) => {
            this.map.getCanvas().style.cursor = 'pointer';
            this.showPopup(e);
        });
        this.map.on('mouseleave', 'cities-layer', () => {
            this.map.getCanvas().style.cursor = '';
            this.popup.remove();
        });
        this.map.on('mousemove', 'cities-layer', (e) => this.showPopup(e));

        this.map.on('click', 'cities-layer', (e) => {
            if (e.features.length) {
                const coords = e.features[0].geometry.coordinates;
                this.map.flyTo({ center: coords, zoom: 10 });
            }
        });

        this.updateView();
    }

    showPopup(e) {
        if (!e.features.length) return;
        const feature = e.features[0];

        const cityData = this.data.cities[feature.properties.name];
        const sunnyPct = cityData ? Math.round(cityData.stats.avgSun * 100) : 50;
        const cloudPct = cityData ? Math.round(cityData.stats.avgCloud * 100) : 50;
        const temp = cityData ? Math.round(cityData.stats.avgTemp) : 70;

        const html = `
            <div class="popup-city">${feature.properties.name}</div>
            <div class="popup-score">Score: <strong>${feature.properties.score}</strong> (Rank #${feature.properties.rank})</div>
            <div class="popup-detail">
                <div class="popup-stat">Sun: ${sunnyPct}%</div>
                <div class="popup-stat">Cloud: ${cloudPct}%</div>
                <div class="popup-stat" style="grid-column: span 2;">Temp: ${temp}°F</div>
            </div>
        `;

        this.popup.setLngLat(feature.geometry.coordinates)
            .setHTML(html)
            .addTo(this.map);
    }

    updateWeight(type, val) {
        this.weights[type] = parseInt(val);
        const labelEl = document.getElementById(`val-${type}`);
        if (labelEl) {
            if (type == 'cloud') labelEl.textContent = `Penalty: ${val}`;
            else if (type == 'heat') labelEl.textContent = `Avoid: ${val}`;
            else labelEl.textContent = `${val}`;
        }
        this.updateView();
    }

    calculateScore(city) {
        const avgCloud = city.stats.avgCloud;
        const avgTemp = city.stats.avgTemp;
        const avgSun = city.stats.avgSun;
        const tempScore = Math.max(0, 1 - ((avgTemp - 65) / 30));

        const sSun = (avgSun * this.weights.sun);
        const sCloud = ((1 - avgCloud) * this.weights.cloud);
        const sHeat = (tempScore * this.weights.heat);

        return Math.floor(sSun + sCloud + sHeat + 50);
    }

    updateView() {
        const scores = [];
        if (!this.data.cities) return;

        Object.values(this.data.cities).forEach(city => {
            scores.push({
                city: city,
                score: this.calculateScore(city)
            });
        });

        scores.sort((a, b) => b.score - a.score);

        this.listContainer.innerHTML = '';
        scores.forEach((item, i) => {
            const rank = i + 1;
            item.rank = rank;

            const card = document.createElement('div');
            card.className = 'city-card';
            card.innerHTML = `
                <div class="city-rank ${rank <= 3 ? 'top-3' : ''}">#${rank}</div>
                <div class="city-name">${item.city.name}</div>
                <div class="city-score">${item.score}</div>
            `;
            // Add click to fly
            card.onclick = () => {
                if (this.map) this.map.flyTo({ center: [item.city.lon, item.city.lat], zoom: 9 });
            };
            this.listContainer.appendChild(card);
        });

        if (this.map && this.map.getSource('cities')) {
            const features = scores.map(item => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [item.city.lon, item.city.lat]
                },
                properties: {
                    name: item.city.name,
                    score: item.score,
                    rank: item.rank
                }
            }));

            this.map.getSource('cities').setData({
                type: 'FeatureCollection',
                features: features
            });
        }
    }
}

// --- SECTION 1: FOG HOOK ---
class FogController {
    constructor() {
        this.canvas = document.getElementById('fog-overlay');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.initFog();

        window.addEventListener('resize', () => {
            this.resize();
            this.initFog(); // Risky reset? Maybe just resize and keep content? 
            // For simplicity, reset fog on resize is fine.
        });

        this.canvas.addEventListener('mousemove', (e) => this.scratch(e));
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Stop scroll while scratching
            this.scratch(e.touches[0]);
        }, { passive: false });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initFog() {
        const { width, height } = this.canvas;
        const ctx = this.ctx;

        // 1. Fill with base gray
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#bdc3c7'; // Fog gray
        ctx.fillRect(0, 0, width, height);

        // 2. Add some "Texture"
        // Simple noise
        ctx.fillStyle = '#ecf0f1';
        for (let i = 0; i < 300; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const r = Math.random() * 200 + 50;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.globalAlpha = 0.1;
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // 3. Pre-clear center area? No, let user do it.
    }

    scratch(e) {
        if (!e) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.ctx.globalCompositeOperation = 'destination-out';

        // Soft Brush
        const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, 150);
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0.5)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 150, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

// --- INIT ---
const app = {
    init: () => { }
};

window.onload = () => {
    // Process Data
    const processedData = new Dataset(SOCAL_DATA);

    app.data = processedData;
    app.cloudWall = new CloudWall(processedData);
    app.playground = new CloudPlayground(processedData);
    app.gloom = new GloomScatter(processedData);
    app.cities = new CityRanker(processedData); // Mapbox version

    // Interactive Fog
    app.fog = new FogController();

    // Background Grid
    app.hero = new HeroGrid();

    // Quick Init for Lab if needed
    app.lab = new ClimateLab(processedData);
};
