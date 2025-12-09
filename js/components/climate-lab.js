class ClimateLab {
    constructor(dataset) {
        this.dataset = dataset;
        this.containerInfo = {
            id: '#climate-lab .lab-container',
            width: 0,
            height: 0
        };
        this.mainContainer = document.querySelector(this.containerInfo.id);

        // Config: Steps
        // driver1 = Left Axis (Color 1), driver2 = Right Axis (Color 2)
        this.scenes = [
            {
                id: 'temp',
                title: '1. Temperature Lag',
                text: 'Temperature (Red) peaks in August, significantly later than the summer solstice. Cloud cover (Grey) remains high through mid-summer, only dropping to its minimum in October.',
                driver1: 'temp',
                driver2: 'clt',
                driverColor1: '#d95f02',
                driverColor2: '#999999',
                future: false
            },
            {
                id: 'pressure',
                title: '2. Atmospheric Pressure',
                text: 'High Pressure (Purple) traps cool marine air near the surface. The pressure pattern closely follows cloud cover, maintaining the marine layer during the summer months.',
                driver1: 'pressure',
                driver2: 'clt',
                driverColor1: '#7570b3',
                driverColor2: '#999999',
                future: false
            },
            {
                id: 'wind',
                title: '3. Onshore Winds',
                text: 'Wind speed (Blue) peaks in late Spring (May/June). Strong onshore winds push moist ocean air inland, contributing to the formation of the marine layer.',
                driver1: 'wind',
                driver2: 'clt',
                driverColor1: '#1f78b4',
                driverColor2: '#999999',
                future: false
            },
            {
                id: 'solar',
                title: '4. Solar Protection',
                text: 'Solar Radiation (Orange) peaks in June. Cloud cover is thickest during this time, reflecting sunlight and keeping the coast cooler than inland areas.',
                driver1: 'solar',
                driver2: 'clt',
                driverColor1: '#e6ab02',
                driverColor2: '#999999',
                future: false
            },
            {
                id: 'future',
                title: '5. Future Projections',
                text: 'In a high-warming scenario (SSP5-8.5), temperatures are projected to increase (Dashed Red). A decrease in cloud cover (Dashed Grey) would reduce protection from the sun.',
                driver1: 'temp',
                driver2: 'clt',
                driverColor1: '#d95f02',
                driverColor2: '#999999',
                future: true
            },
            {
                id: 'explorer',
                title: '6. Climate Explorer',
                text: 'Use the controls below to compare different variables. You can also toggle future projections to see how these patterns might change by 2100.',
                driver1: 'temp', // Defaults
                driver2: 'clt',
                driverColor1: '#d95f02',
                driverColor2: '#999999',
                future: false,
                unlocked: true
            }
        ];

        this.state = {
            step: 0,
            driver1: 'temp',
            driver2: 'clt',
            showFuture: false
        };

        this.config = {
            vars: {
                clt: { label: 'Cloud Cover', unit: '%', color: '#555' }, // Neutral for explorer
                temp: { label: 'Temperature', unit: '°F', color: '#d95f02' },
                pressure: { label: 'Pressure', unit: 'hPa', color: '#7570b3' },
                wind: { label: 'Wind Speed', unit: 'mph', color: '#1f78b4' },
                solar: { label: 'Solar Rad', unit: 'W/m²', color: '#e6ab02' }
            },
            margins: { top: 40, right: 60, bottom: 40, left: 60 }
        };

        this.domains = {};

        if (this.mainContainer && this.dataset.climatology) {
            this.init();
        } else {
            console.warn('ClimateLab: Missing container or data.');
        }
    }

    init() {
        this.calculateDomains();
        this.renderLayout();
        this.setupViz();
        this.updateScene();

        // Remove existing tooltips to avoid dupes on re-init
        d3.selectAll('.chart-tooltip-global').remove();

        // Tooltip appended to BODY to avoid clipping
        this.tooltip = d3.select('body').append('div')
            .attr('class', 'chart-tooltip chart-tooltip-global')
            .style('opacity', 0);
    }

    calculateDomains() {
        const keys = Object.keys(this.config.vars);
        keys.forEach(k => {
            let values = [];
            // Historical
            for (let m = 1; m <= 12; m++) {
                values.push(this.dataset.climatology.historical[m][k]);
            }
            // Future (SSP585)
            for (let m = 1; m <= 12; m++) {
                values.push(this.dataset.climatology.ssp585[m][k]);
            }

            const min = d3.min(values);
            const max = d3.max(values);
            const range = max - min;
            const pad = range === 0 ? 1 : range * 0.1;

            if (k === 'clt') {
                this.domains[k] = { min: 0, max: 100 };
            } else {
                this.domains[k] = { min: min - pad, max: max + pad };
            }
        });
    }

    renderLayout() {
        this.mainContainer.innerHTML = '';

        // --- VIZ AREA (Left) ---
        const vizArea = document.createElement('div');
        vizArea.className = 'lab-viz-area';

        this.chartTitle = document.createElement('div');
        this.chartTitle.className = 'lab-chart-title';
        vizArea.appendChild(this.chartTitle);

        this.vizTarget = document.createElement('div');
        this.vizTarget.id = 'cl-viz-target';
        this.vizTarget.style.width = '100%';
        this.vizTarget.style.height = '100%';
        vizArea.appendChild(this.vizTarget);

        this.mainContainer.appendChild(vizArea);

        // --- SIDEBAR (Right) ---
        const sidebar = document.createElement('div');
        sidebar.className = 'lab-sidebar';

        const storyCard = document.createElement('div');
        storyCard.className = 'story-card';
        storyCard.innerHTML = `
            <div class="story-step-indicator" id="cl-step-num">Step 1/6</div>
            <div class="story-title" id="cl-story-title">--</div>
            <div class="story-text" id="cl-story-text">--</div>
            <div class="story-controls">
                <button class="nav-btn" id="cl-prev-btn">← Prev</button>
                <button class="nav-btn primary" id="cl-next-btn">Next →</button>
            </div>
            
            <div class="mech-explorer" id="cl-explorer">
                <div class="explorer-grid">
                    <div class="col-left">
                        <div class="explorer-label">Left Axis</div>
                        <div class="mech-btn-list" id="list-driver1">
                            ${this.renderBtnList('1')}
                        </div>
                    </div>
                    <div class="col-right">
                        <div class="explorer-label">Right Axis</div>
                        <div class="mech-btn-list" id="list-driver2">
                             ${this.renderBtnList('2')}
                        </div>
                    </div>
                </div>
                
                <div class="future-toggle-container">
                    <label class="toggle-switch">
                        <input type="checkbox" id="btn-future-check" onchange="app.lab.toggleFuture(this.checked)">
                        <span class="slider round"></span>
                    </label>
                    <span class="toggle-label">Show Future (2100)</span>
                </div>
            </div>
        `;
        sidebar.appendChild(storyCard);
        this.mainContainer.appendChild(sidebar);

        // Legend
        const legend = document.createElement('div');
        legend.className = 'chart-legend';
        legend.innerHTML = `
            <div class="legend-item">
                <span class="legend-dot" id="legend-dot-1"></span>
                <span id="legend-label-1">Var 1</span>
            </div>
            <div class="legend-item">
                <span class="legend-dot" id="legend-dot-2"></span>
                <span id="legend-label-2">Var 2</span>
            </div>
            <div class="legend-item" id="legend-future-item" style="opacity:0">
                 <span class="legend-line-dashed"></span>
                 <span>Projections</span>
            </div>
        `;
        vizArea.appendChild(legend);

        // Binds
        document.getElementById('cl-prev-btn').onclick = () => this.changeStep(-1);
        document.getElementById('cl-next-btn').onclick = () => this.changeStep(1);
    }

    renderBtnList(suffix) {
        // Generates buttons for Temp, Pressure, Wind, Solar, Cloud
        const opts = [
            { id: 'temp', label: 'Temp' },
            { id: 'pressure', label: 'Pressure' },
            { id: 'wind', label: 'Wind' },
            { id: 'solar', label: 'Solar' },
            { id: 'clt', label: 'Cloud' } // CLT
        ];
        return opts.map(o => `
            <button class="mech-btn-small" id="btn-${o.id}-${suffix}" 
                onclick="app.lab.setExplorerDriver('${o.id}', ${suffix})">${o.label}</button>
        `).join('');
    }

    setupViz() {
        const width = 600;
        const height = 400;
        const m = this.config.margins;

        this.svg = d3.select('#cl-viz-target').append('svg')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .classed('climate-svg', true);

        this.g = this.svg.append('g')
            .attr('transform', `translate(${m.left},${m.top})`);

        this.innerWidth = width - m.left - m.right;
        this.innerHeight = height - m.top - m.bottom;

        // X Scale
        this.xScaleLinear = d3.scaleLinear()
            .range([0, this.innerWidth])
            .domain([0, 11]);

        // Y Scales (Two of them)
        this.yScale1 = d3.scaleLinear().range([this.innerHeight, 0]);
        this.yScale2 = d3.scaleLinear().range([this.innerHeight, 0]);

        // Axes Groups
        this.xAxisG = this.g.append('g')
            .attr('class', 'axis axis--x')
            .attr('transform', `translate(0,${this.innerHeight})`);

        this.yAxis1G = this.g.append('g').attr('class', 'axis axis--y axis--left');
        this.yAxis2G = this.g.append('g').attr('class', 'axis axis--y axis--right')
            .attr('transform', `translate(${this.innerWidth},0)`);

        // Static X Axis
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        this.xAxisG.call(d3.axisBottom(this.xScaleLinear)
            .tickFormat(i => monthNames[i])
            .ticks(12));

        this.xAxisG.select('.domain').remove();
        this.xAxisG.selectAll('line').remove();
        this.xAxisG.selectAll('text').attr('dy', '1em').style('font-family', 'var(--font-mono)');

        // Line Generators
        this.line1 = d3.line().curve(d3.curveCatmullRom).x((d, i) => this.xScaleLinear(i)).y(d => this.yScale1(d));
        this.line2 = d3.line().curve(d3.curveCatmullRom).x((d, i) => this.xScaleLinear(i)).y(d => this.yScale2(d));

        // Paths
        this.path1Fut = this.g.append('path').attr('class', 'line line-fut');
        this.path2Fut = this.g.append('path').attr('class', 'line line-fut');
        this.path1 = this.g.append('path').attr('class', 'line line-main');
        this.path2 = this.g.append('path').attr('class', 'line line-main');

        // Overlay for hover
        this.rectOverlay = this.g.append('rect')
            .attr('class', 'overlay')
            .attr('width', this.innerWidth)
            .attr('height', this.innerHeight)
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .on('mousemove', (event) => this.handleMouseMove(event))
            .on('mouseleave', () => this.handleMouseLeave());

        // Hover Elements
        this.hoverG = this.g.append('g').style('opacity', 0).style('pointer-events', 'none');
        this.hoverLine = this.hoverG.append('line')
            .attr('class', 'hover-line')
            .attr('y1', 0).attr('y2', this.innerHeight);
        this.hoverDot1 = this.hoverG.append('circle').attr('r', 5).attr('class', 'dot-1');
        this.hoverDot2 = this.hoverG.append('circle').attr('r', 5).attr('class', 'dot-2');
    }

    updateScene() {
        const scene = this.scenes[this.state.step];

        // Apply scene drivers if not in free explorer mode (even in explorer, init with defaults)
        if (!scene.unlocked) {
            this.state.driver1 = scene.driver1;
            this.state.driver2 = scene.driver2;
            this.state.showFuture = scene.future;
            const chk = document.getElementById('btn-future-check');
            if (chk) chk.checked = scene.future;
        }

        // Text Updates
        d3.select('#cl-step-num').text(`Step ${this.state.step + 1} of ${this.scenes.length}`);
        d3.select('#cl-story-title').text(scene.title);
        d3.select('#cl-story-text').text(scene.text);

        document.getElementById('cl-prev-btn').disabled = (this.state.step === 0);
        const nextBtn = document.getElementById('cl-next-btn');
        nextBtn.textContent = (this.state.step === this.scenes.length - 1) ? "Reset Story ↺" : "Next →";

        // Colors
        let c1, c2;
        if (scene.unlocked) {
            c1 = this.config.vars[this.state.driver1].color;
            c2 = this.config.vars[this.state.driver2].color;
        } else {
            c1 = scene.driverColor1;
            c2 = scene.driverColor2;
        }

        // Update Legend
        document.getElementById('legend-label-1').textContent = this.config.vars[this.state.driver1].label;
        document.getElementById('legend-dot-1').style.backgroundColor = c1;

        document.getElementById('legend-label-2').textContent = this.config.vars[this.state.driver2].label;
        document.getElementById('legend-dot-2').style.backgroundColor = c2;

        document.getElementById('legend-future-item').style.opacity = this.state.showFuture ? 1 : 0;

        // UI Controls
        const explorer = document.getElementById('cl-explorer');
        if (scene.unlocked) {
            explorer.classList.add('active');
            this.updateExplorerUI(c1, c2);
        } else {
            explorer.classList.remove('active');
        }

        this.drawViz(c1, c2);
    }

    updateExplorerUI(c1, c2) {
        // Update Buttons
        document.querySelectorAll('.mech-btn-small').forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = '#ddd';
            b.style.color = '#666';
            b.style.boxShadow = 'none';
        });

        // Active 1
        const b1 = document.getElementById(`btn-${this.state.driver1}-1`);
        if (b1) {
            b1.classList.add('active');
            b1.style.borderColor = c1;
            b1.style.color = c1;
            b1.style.boxShadow = `0 0 4px ${c1}33`;
        }

        // Active 2
        const b2 = document.getElementById(`btn-${this.state.driver2}-2`);
        if (b2) {
            b2.classList.add('active');
            b2.style.borderColor = c2;
            b2.style.color = c2;
            b2.style.boxShadow = `0 0 4px ${c2}33`;
        }
    }

    drawViz(c1, c2) {
        const d1 = this.state.driver1;
        const d2 = this.state.driver2;

        const dom1 = this.domains[d1];
        const dom2 = this.domains[d2];

        // 1. Update Scales
        this.yScale1.domain([dom1.min, dom1.max]);
        this.yScale2.domain([dom2.min, dom2.max]);

        // 2. Axes
        const fmt = (val, id) => {
            const u = this.config.vars[id].unit;
            // FIXED: Removed replacement of W/m² to ensure it displays
            return val + u.replace('°F', '°').replace('hPa', 'mb');
        };

        const ax1 = d3.axisLeft(this.yScale1).ticks(5).tickFormat(d => fmt(d, d1));
        const ax2 = d3.axisRight(this.yScale2).ticks(5).tickFormat(d => fmt(d, d2));

        this.yAxis1G.transition().duration(750).call(ax1);
        this.yAxis2G.transition().duration(750).call(ax2);

        // Axis Styling
        this.yAxis1G.selectAll('text').style('fill', c1).style('font-weight', 'bold');
        this.yAxis2G.selectAll('text').style('fill', c2).style('font-weight', 'bold');
        this.yAxis1G.select('.domain').remove();
        this.yAxis2G.select('.domain').remove();
        this.yAxis1G.selectAll('line').style('stroke', '#eee');
        this.yAxis2G.selectAll('line').style('stroke', '#eee');

        // 3. Data
        const hist = this.dataset.climatology.historical;
        const fut = this.dataset.climatology.ssp585;

        const data1H = [], data2H = [], data1F = [], data2F = [];
        for (let m = 1; m <= 12; m++) {
            data1H.push(hist[m][d1]);
            data2H.push(hist[m][d2]);
            data1F.push(fut[m][d1]);
            data2F.push(fut[m][d2]);
        }

        // 4. Lines
        const t = d3.transition().duration(750);

        this.path1.datum(data1H).transition(t).attr('d', this.line1).attr('stroke', c1).attr('stroke-width', 3).attr('fill', 'none');
        this.path2.datum(data2H).transition(t).attr('d', this.line2).attr('stroke', c2).attr('stroke-width', 3).attr('fill', 'none');

        const show = this.state.showFuture;
        this.path1Fut.datum(data1F).transition(t).attr('d', this.line1).attr('stroke', c1).attr('stroke-dasharray', '4,4').attr('fill', 'none').style('opacity', show ? 0.6 : 0);
        this.path2Fut.datum(data2F).transition(t).attr('d', this.line2).attr('stroke', c2).attr('stroke-dasharray', '4,4').attr('fill', 'none').style('opacity', show ? 0.6 : 0);

        // Title
        this.chartTitle.innerHTML = `<span style="color:${c1}">${this.config.vars[d1].label}</span> vs <span style="color:${c2}">${this.config.vars[d2].label}</span>`;
    }

    handleMouseMove(event) {
        const [mx] = d3.pointer(event);
        const idx = Math.round(this.xScaleLinear.invert(mx));
        if (idx < 0 || idx > 11) return;

        const m = idx + 1;
        const d1 = this.state.driver1;
        const d2 = this.state.driver2;

        const h1 = this.dataset.climatology.historical[m][d1];
        const h2 = this.dataset.climatology.historical[m][d2];
        const f1 = this.dataset.climatology.ssp585[m][d1];
        const f2 = this.dataset.climatology.ssp585[m][d2];

        const xPos = this.xScaleLinear(idx);
        const y1 = this.yScale1(h1);
        const y2 = this.yScale2(h2);

        this.hoverG.style('opacity', 1);
        this.hoverLine.attr('x1', xPos).attr('x2', xPos);

        // Interactive colors (use scene or config?)
        const scene = this.scenes[this.state.step];
        const c1 = scene.unlocked ? this.config.vars[d1].color : scene.driverColor1;
        const c2 = scene.unlocked ? this.config.vars[d2].color : scene.driverColor2;

        this.hoverDot1.attr('cx', xPos).attr('cy', y1).style('fill', c1);
        this.hoverDot2.attr('cx', xPos).attr('cy', y2).style('fill', c2);

        // Tooltip (Absolute Body Position)
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const u1 = this.config.vars[d1].unit;
        const u2 = this.config.vars[d2].unit;

        const html = `
            <div class="tt-title">${monthNames[idx]}</div>
            <div class="tt-row" style="color:${c1}">
                <span>${this.config.vars[d1].label}:</span>
                <span>${h1.toFixed(1)}${u1}</span>
                ${this.state.showFuture ? `<span class="tt-fut">➜ ${f1.toFixed(1)}</span>` : ''}
            </div>
            <div class="tt-row" style="color:${c2}">
                <span>${this.config.vars[d2].label}:</span>
                <span>${h2.toFixed(1)}${u2}</span>
                ${this.state.showFuture ? `<span class="tt-fut">➜ ${f2.toFixed(1)}</span>` : ''}
            </div>
        `;

        this.tooltip.html(html)
            .style('opacity', 1)
            .style('left', (event.pageX + 20) + 'px')
            .style('top', (event.pageY - 20) + 'px');
    }

    handleMouseLeave() {
        this.hoverG.style('opacity', 0);
        this.tooltip.style('opacity', 0);
    }

    changeStep(delta) {
        let newStep = this.state.step + delta;
        if (newStep < 0) newStep = 0;
        if (newStep >= this.scenes.length) newStep = 0;
        this.state.step = newStep;
        this.updateScene();
    }

    setExplorerDriver(id, slot) {
        if (slot === 1) this.state.driver1 = id;
        if (slot === 2) this.state.driver2 = id;
        this.updateScene();
    }

    toggleFuture(isChecked) {
        this.state.showFuture = isChecked;
        this.updateScene();
    }
}
