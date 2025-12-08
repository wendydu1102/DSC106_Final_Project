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
