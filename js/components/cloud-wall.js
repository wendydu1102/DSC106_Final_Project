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
