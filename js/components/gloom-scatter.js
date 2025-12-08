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
