class MechanismViz {
    constructor(data) {
        this.data = data;
        this.containerId = 'mech-canvas-container';

        // Config
        this.margin = { top: 40, right: 40, bottom: 40, left: 40 };
        this.gridRows = 20;
        this.gridCols = 40;

        this.currentState = 1;
        this.currentTime = 0; // Burn-off slider value 0-100

        this.init();
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Dimensions
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        // Create SVG
        this.svg = d3.select(container).append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .style("position", "absolute")
            .style("top", 0)
            .style("left", 0);

        // Define Grid Data (Parcel model)
        // Each dot represents a parcel of air
        this.dots = [];
        for (let r = 0; r < this.gridRows; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                this.dots.push({
                    id: `${r}-${c}`,
                    row: r,
                    col: c,
                    x: 0,
                    y: 0,
                    type: 'marine', // marine, warm, trapped
                    opacity: 1,
                    radius: 3
                });
            }
        }

        // Draw Terrain Background (Static)
        this.drawTerrain();

        // Init Dot Groups
        this.dotGroup = this.svg.append("g").attr("class", "mech-dots");

        // Initial Layout
        this.updateLayout(1);

        // Setup Intersection Observer for steps
        this.setupScrollytelling();

        // Setup Slider
        this.setupControls();

        // Resize handler
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = document.getElementById(this.containerId);
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        this.svg.attr("width", this.width).attr("height", this.height);

        // Redraw terrain
        this.svg.selectAll(".mech-terrain").remove();
        this.drawTerrain();

        // Update dots
        this.updateLayout(this.currentState);
    }

    drawTerrain() {
        // Simple elegant line
        // Ocean (0-0.3) -> Coast (0.3-0.5) -> Basin (0.5-0.7) -> Mountain (0.7-0.9) -> Desert (0.9-1.0)

        const w = this.width;
        const h = this.height;
        const groundY = h * 0.9;
        const peakY = h * 0.4;
        const basinY = h * 0.85;

        // Area generator
        const area = d3.area()
            .x(d => d.x)
            .y0(h)
            .y1(d => d.y)
            .curve(d3.curveBasis);

        const terrainPoints = [
            { x: 0, y: groundY }, // Sea
            { x: w * 0.3, y: groundY }, // Coast start
            { x: w * 0.5, y: basinY }, // LA Basin
            { x: w * 0.65, y: basinY }, // Foothills
            { x: w * 0.8, y: peakY }, // San Gabriel Peak
            { x: w, y: h * 0.7 } // High Desert
        ];

        this.svg.insert("path", ":first-child")
            .datum(terrainPoints)
            .attr("class", "mech-terrain")
            .attr("d", area)
            .attr("fill", "#0f172a") // Match bg
            .attr("stroke", "#334155")
            .attr("stroke-width", 2);

        // Labels (Minimalist)
        const labels = [
            { t: "PACIFIC OCEAN", x: w * 0.15, y: groundY + 20 },
            { t: "COAST (LA)", x: w * 0.4, y: groundY + 20 },
            { t: "MOUNTAINS", x: w * 0.8, y: peakY - 15 }
        ];

        this.svg.selectAll(".mech-label").remove();
        this.svg.selectAll(".mech-label")
            .data(labels).enter().append("text")
            .attr("class", "mech-terrain mech-label")
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .text(d => d.t)
            .attr("text-anchor", "middle")
            .attr("fill", "#64748b")
            .style("font-size", "10px")
            .style("letter-spacing", "1px")
            .style("font-family", "Inter, sans-serif");
    }

    // Core Logic: Calculate Postions based on State
    getDotState(dot, step) {
        const w = this.width;
        const h = this.height;
        const cellW = w / this.gridCols;
        const cellH = (h * 0.8) / this.gridRows; // Use top 80%

        let tx = dot.col * cellW;
        let ty = dot.row * cellH + (h * 0.1); // Margin top
        let color = "#3b82f6"; // Blue (Marine)
        let opacity = 0.6;
        let radius = 2.5;

        // --- STEP 1: THE NORMAL ATMOSPHERE ---
        if (step === 1) {
            // Standard Lapse Rate: Air gets colder (lighter blue) as you go up
            // Base (Row 19) = Blue (#3b82f6)
            // Top (Row 0) = Light Blue/White (#e2e8f0)

            const intensity = 1 - (dot.row / this.gridRows); // 0 at bottom, 1 at top
            // Interpolate color? Simple logic:
            if (dot.row < 10) color = "#cbd5e1"; // Cooler/Lighter aloft
            else color = "#3b82f6"; // Warmer/Denser blue surface
        }

        // --- STEP 2: THE INVERSION LAYER ---
        else if (step >= 2) {
            const inversionRow = 8; // Row 8 is the boundary

            if (dot.row < inversionRow) {
                // WARM AIR (The Lid) - Sinking, heating up
                color = "#f97316";
                opacity = 0.8;

                // Compress them slightly to show high pressure sinking
                ty = dot.row * (cellH * 0.9) + (h * 0.1);
            } else {
                // COOL MARINE AIR - Trapped below
                color = "#3b82f6";
                opacity = 0.9;

                // Compressed down by the lid
                ty = dot.row * (cellH * 0.6) + (h * 0.35);
            }
        }

        // --- STEP 3: THE TRAP (Mountains Block) ---
        if (step >= 3) {
            const mountainCol = Math.floor(this.gridCols * 0.7); // 70% across

            // If dot is "Warm" (Inversion), it flows over mountains
            const isWarm = (dot.row < 8);

            if (!isWarm) {
                // Marine layer is trapped!
                if (dot.col > mountainCol) {
                    // Push them back to the left (pile up)
                    // Map col range [mountainCol, max] -> [mountainCol-10, mountainCol]
                    // Randomize slightly to show "Pile up"
                    tx = (mountainCol * cellW) - (Math.random() * (w * 0.2));
                    ty += (Math.random() * 20 - 10); // Turbulence
                    opacity = 1; // Dense fog
                    radius = 3.5;
                }
            } else {
                // Warm air flows over smoothly
                // No change
            }
        }

        // --- STEP 4: BURN OFF ---
        if (step === 4) {
            const isWarm = (dot.row < 8);
            if (!isWarm) {
                // Check burn slider
                // Burn from bottom up? Or opacity fade?
                // Let's fade opacity based on sun (this.currentTime 0-100)

                // Threshold: e.g. at 50%, the bottom 50% of dots are gone
                const burnThreshold = (this.currentTime / 100) * this.gridRows;
                // Invert logic: Burn from bottom (high row index) to top? 
                // Actually sun heats ground, so ground fog burns first?
                // Usually fog burns from edges. Let's simplfy: Bottom-up.

                // Marine rows are 8 to 20.
                const marineRows = 20 - 8;
                const rowFromBottom = (this.gridRows - dot.row);

                // If scrub is 0, full opacity. If scrub 100, 0 opacity.
                // Staggered: 
                const burnLevel = (this.currentTime / 100) * (marineRows + 5);

                if (rowFromBottom < burnLevel) {
                    opacity = 0;
                    radius = 0;
                }
            }
        }

        return { x: tx, y: ty, color, opacity, radius };
    }

    updateLayout(step) {
        // Calculate new state for all dots
        const dotData = this.dots.map(d => ({
            ...d,
            ...this.getDotState(d, step)
        }));

        const circles = this.dotGroup.selectAll("circle")
            .data(dotData, d => d.id);

        // Enter
        const enter = circles.enter().append("circle")
            .attr("cx", d => d.x + Math.random() * 20) // Enter random
            .attr("cy", d => d.y)
            .attr("r", 0)
            .attr("fill", d => d.color);

        // Update + Enter
        enter.merge(circles)
            .transition()
            .duration(1000)
            .ease(d3.easeCubicInOut)
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", d => d.radius)
            .attr("fill", d => d.color)
            .style("opacity", d => d.opacity);

        // Exit
        circles.exit().remove();

        // Handle "Inversion Line" Visual
        this.updateOverlays(step);
    }

    updateOverlays(step) {
        // Draw/Update the dashed line for inversion
        const h = this.height;
        const w = this.width;

        // Remove old
        this.svg.selectAll(".mech-overlay").remove();

        if (step >= 2) {
            const inversionY = (h * 0.1) + (8 * ((h * 0.8) / this.gridRows) * 0.8) + 10;
            // approx between row 7 and 8

            this.svg.append("line")
                .attr("class", "mech-overlay")
                .attr("x1", 0)
                .attr("x2", w)
                .attr("y1", inversionY)
                .attr("y2", inversionY)
                .attr("stroke", "#f97316")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5")
                .style("opacity", 0)
                .transition().delay(500).duration(1000)
                .style("opacity", 1);

            this.svg.append("text")
                .attr("class", "mech-overlay")
                .attr("x", 20)
                .attr("y", inversionY - 10)
                .text("WARM INVERSION LAYER")
                .attr("fill", "#f97316")
                .style("font-size", "11px")
                .style("font-weight", "bold")
                .style("font-family", "Inter")
                .style("opacity", 0)
                .transition().delay(500).duration(1000)
                .style("opacity", 1);
        }
    }

    // --- INTERACTION ---

    setState(step) {
        this.currentState = step;
        this.updateLayout(step);

        const controls = document.getElementById('mech-final-controls');
        if (step === 4) {
            if (controls) controls.classList.remove('hidden');
        } else {
            if (controls) controls.classList.add('hidden');
            // Reset slider visual
            this.currentTime = 0;
            const s = document.getElementById('mech-scrubber');
            if (s) s.value = 0;
        }
    }

    setupScrollytelling() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const step = parseInt(entry.target.getAttribute('data-step'));
                    this.setState(step);
                    document.querySelectorAll('.mech-step').forEach(s => s.classList.remove('active'));
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.5 });
        document.querySelectorAll('.mech-step').forEach(s => observer.observe(s));
    }

    setupControls() {
        const slider = document.getElementById('mech-scrubber');
        if (slider) {
            slider.addEventListener('input', (e) => {
                this.currentTime = parseFloat(e.target.value);
                // Real-time update for Step 4
                if (this.currentState === 4) {
                    this.updateLayout(4);
                }
            });
        }
    }
}
