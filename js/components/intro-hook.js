class IntroHook {
    constructor() {
        this.container = document.getElementById('intro-hook');
        this.currentSlide = 0;

        // Initialize words (Load from LocalStorage if available)
        // Use external data if available, else fallback
        this.baseWords = window.WORD_CLOUD_DATA || [
            { text: "Beach", count: 2450 },
            { text: "Sun", count: 1890 }
        ];
        this.words = this.loadWords();

        this.init();
    }

    loadWords() {
        const stored = localStorage.getItem('intro_words');
        // Always start with fresh copy of base words to ensure we have the external data
        let merged = JSON.parse(JSON.stringify(this.baseWords));

        if (stored) {
            try {
                const userWords = JSON.parse(stored);
                userWords.forEach(uw => {
                    const existing = merged.find(w => w.text.toLowerCase() === uw.text.toLowerCase());
                    if (existing) {
                        existing.count += uw.count;
                    } else {
                        merged.push(uw);
                    }
                });
            } catch (e) {
                console.error("Failed to load words", e);
            }
        }
        return merged;
    }

    saveWord(text) {
        // Simple storage: just store array of user added words
        let stored = localStorage.getItem('intro_words');
        let userWords = stored ? JSON.parse(stored) : [];

        // Check if I added this before?
        // Let's just blindly add or increment for now
        // Check if I added this before?
        const existing = userWords.find(w => w.text.toLowerCase() === text.toLowerCase());
        if (existing) {
            existing.count++;
            existing.isUser = true; // Ensure flagged
        } else {
            userWords.push({ text: text, size: 30, count: 1, isUser: true });
        }
        localStorage.setItem('intro_words', JSON.stringify(userWords));
    }

    init() {
        if (!this.container) return;

        // Setup Inputs
        const input = document.getElementById('intro-word-input');
        const btn = document.getElementById('intro-word-submit');

        if (btn) btn.addEventListener('click', () => this.handleInput());
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleInput();
            });
        }

        // --- GLOBAL TAP NAVIGATION ---
        this.container.addEventListener('click', (e) => {
            // Ignore if clicking interactive elements
            if (e.target.closest('input') ||
                e.target.closest('button') ||
                e.target.closest('.story-progress-bar') ||
                e.target.closest('.story-chip')) return;

            const width = window.innerWidth;
            const x = e.clientX;

            // Slide 1 (Input Exception):
            // If user hasn't input anything, maybe we don't allow next?
            // But if they tap right, we can assume they want to skip or proceed if valid.
            // Let's allow navigation generally for fluidity, unless on Input and empty?
            // For now, normal behavior:

            if (this.currentSlide === "1") return; // Require explicit post for Input
            if (this.currentSlide === "3") return; // Require explicit Card Click for Finish

            if (x < width * 0.3) {
                // LEFT TAP (30% zone) -> PREV
                this.navigate(-1);
            }
            else {
                // RIGHT TAP (70% zone) -> NEXT
                this.navigate(1);
            }
        });

        // --- KEYBOARD NAVIGATION ---
        document.addEventListener('keydown', (e) => {
            // Only active if Intro is active
            if (this.container.classList.contains('hidden') ||
                this.container.style.display === 'none') return;

            if (e.key === 'ArrowLeft') {
                if (this.currentSlide === "1") return; // Same rule
                this.navigate(-1);
            } else if (e.key === 'ArrowRight') {
                this.navigate(1);
            }
        });

        // Setup Tooltip (Append to container for correct z-index context)
        this.tooltip = d3.select("#intro-hook").append("div")
            .attr("class", "word-tooltip")
            .style("opacity", 0);

        // --- BIND SKIP & REPLAY BUTTONS ---

        // Skip Button (Inside Intro)
        const skipBtn = document.getElementById('intro-skip-btn');
        if (skipBtn) {
            skipBtn.onclick = (e) => {
                e.stopPropagation(); // prevent nav
                this.finish();
            };
        }

        // Replay Button (Outside Intro - Hero)
        const replayBtn = document.getElementById('replay-story-btn');
        if (replayBtn) {
            replayBtn.onclick = () => {
                console.log("Replaying Story...");
                this.restart();
            };
        }

        // Start at Slide 1 (or skip if localstorage set? User said "at any point", implies persistence check might need bypass for replay)
        // If Replay clicked, we ignore persistence.
        // init() check handles initial load.

        this.checkPersistence();

        // Start Sequence
        // setTimeout(() => this.step1_MentalImage(), 500); // Replaced by checkPersistence

        // Responsive Resize
        window.addEventListener('resize', () => {
            // Debounce
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                if (this.currentSlide === "1.5") {
                    this.renderWordCloud();
                }
            }, 250);
        });
    }

    checkPersistence() {
        // PER USER REQUEST: START WITH STORY EVERY REFRESH
        // if (localStorage.getItem('intro_completed') === 'true') {
        //     this.container.classList.add('hidden');
        //     this.container.style.display = 'none';
        // } else {
        this.showSlide(1);
        // }
    }

    restart() {
        // Reset State
        this.currentSlide = "1";
        this.container.classList.remove('hidden', 'slide-out');
        this.container.style.display = 'block';

        // Reset Fog State if needed
        d3.select(".intro-slide[data-slide='3']").classed("fog-cleared", false);
        this.startScratchMonitor(); // Restart monitor if stopped

        // Show Slide 1
        this.showSlide(1);
    }

    showSlide(index) {
        document.querySelectorAll('.intro-slide').forEach(s => s.classList.remove('active'));
        const slide = document.querySelector(`.intro-slide[data-slide="${index}"]`);
        if (slide) slide.classList.add('active');
        this.currentSlide = index; // Update current slide
        this.updateProgress(index); // Update progress bar
    }

    navigate(direction) {
        const slides = ["1", "1.5", "2", "3", "4"]; // Added Slide 4
        const currentIndex = slides.indexOf(this.currentSlide.toString());
        let nextIndex = currentIndex + direction;

        // Block Next on Slide 4 (Article)
        if (this.currentSlide === "4" && direction === 1) return;

        if (nextIndex < 0) nextIndex = 0; // Don't go before first slide
        if (nextIndex >= slides.length) {
            // End of slideshow (should use finish() usually, but here we lock)
            if (this.currentSlide === "4") return;
            this.finish();
            return;
        }

        const nextSlide = slides[nextIndex];

        // Specific logic for transitions
        if (nextSlide === "1") this.step1_MentalImage();
        else if (nextSlide === "1.5") this.step1_5_WordCloud();
        else if (nextSlide === "2") this.step2_SunnyFantasy();
        else if (nextSlide === "3") this.step3_GrayReality();
        else if (nextSlide === "4") this.step4_Article();
    }

    updateProgress(currentIndex) {
        // Map slide index to progress order
        const map = { "1": 0, "1.5": 1, "2": 2, "3": 3, "4": 4 };
        const activeIdx = map[currentIndex.toString()];

        document.querySelectorAll('.story-progress-bar').forEach((bar, idx) => {
            const fill = bar.querySelector('.progress-fill');

            // Reset state
            bar.classList.remove('active', 'completed');

            if (idx < activeIdx) {
                bar.classList.add('completed');
            } else if (idx === activeIdx) {
                // Force Reflow to restart animation
                fill.style.width = '0%';
                void bar.offsetWidth; // Trigger reflow
                fill.style.width = ''; // Clear inline style to let CSS take over

                bar.classList.add('active');
            } else {
                // Future: Ensure cleared
                fill.style.width = '0%';
            }
        });
    }

    // --- STEP 1: INPUT ---
    step1_MentalImage() {
        this.showSlide(1);
    }

    fillInput(text) {
        const input = document.getElementById('intro-word-input');
        if (input) {
            input.value = text;
            input.focus();
        }
    }

    addWord(text) {
        if (!text) return;

        // Update local memory state
        const existing = this.words.find(w => w.text.toLowerCase() === text.toLowerCase());
        if (existing) {
            existing.count += 1;
            existing.size += 5;
            existing.isUser = true;
        } else {
            this.words.push({ text: text, size: 30, count: 1, isUser: true });
        }

        // Persist to LocalStorage
        this.saveWord(text);

        // Transition to Viz Slide
        this.step1_5_WordCloud(text);
    }

    handleInput() {
        const input = document.getElementById('intro-word-input');
        const text = input.value.trim();
        if (text) {
            this.addWord(text);
            input.value = '';
        }
    }

    // --- STEP 1.5: WORD CLOUD VIZ ---
    step1_5_WordCloud() {
        this.showSlide("1.5");
        // Delay render slightly to ensure container has size
        setTimeout(() => this.renderWordCloud(), 100);

        // Next button removed, reliance on Tap
    }

    renderWordCloud() {
        const container = document.getElementById('intro-word-cloud');
        if (!container || !d3 || !d3.layout || !d3.layout.cloud) return;

        // Clear previous generic resize listener if exists
        // (Moved to init, but good safety)

        container.innerHTML = '';
        const rect = container.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        // Scale for font size based on count
        // Find min/max
        const counts = this.words.map(w => w.count);
        const minC = Math.min(...counts);
        const maxC = Math.max(...counts);

        const fontScale = d3.scaleLinear()
            .domain([minC, maxC])
            .range([16, 55]); // Cleaner, less extreme range

        // Opacity Scale for Depth
        const opacityScale = d3.scaleLinear()
            .domain([minC, maxC])
            .range([0.5, 1.0]);

        // Sort: User words first (center), then by count
        this.words.sort((a, b) => {
            if (a.isUser && !b.isUser) return -1;
            if (!a.isUser && b.isUser) return 1;
            return b.count - a.count;
        });

        const layout = d3.layout.cloud()
            .size([w, h])
            .words(this.words.map(d => ({
                text: d.text,
                size: fontScale(d.count),
                count: d.count,
                isUser: d.isUser // Pass flag
            })))
            .padding(15) // More padding for "Professional Airiness"
            .rotate(() => 0)
            .font("Inter")
            .fontSize(d => d.size)
            .on("end", draw);

        layout.start();

        function draw(words) {
            const svg = d3.select(container).append("svg")
                .attr("width", w)
                .attr("height", h)
                .style("overflow", "visible")
                .append("g")
                .attr("transform", "translate(" + layout.size()[0] / 2 + "," + layout.size()[1] / 2 + ")");

            svg.selectAll("text")
                .data(words)
                .enter().append("text")
                .style("font-size", d => d.size + "px")
                .style("font-family", "Inter")
                .style("font-weight", 700)
                .style("fill", "#ffffff")
                .style("opacity", d => opacityScale(d.count)) // Depth
                .style("cursor", "pointer")
                .attr("text-anchor", "middle")
                .attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")")
                .text(d => d.text)
                .style("transition", "opacity 0.2s, transform 0.2s") // Smooth hover
                .on("mouseover", function (event, d) {
                    d3.select(this).style("opacity", 1).style("transform", d => `translate(${d.x}px, ${d.y}px) scale(1.1)`);

                    const tooltip = d3.select(".word-tooltip");
                    tooltip.transition().duration(100).style("opacity", 1);
                    tooltip.html(`${d.text} <span style="opacity:0.6; font-weight:400; margin-left:4px;">${d.count.toLocaleString()}</span>`)
                        .style("left", (event.clientX) + "px")
                        .style("top", (event.clientY) + "px");
                })
                .on("mouseout", function (event, d) {
                    d3.select(this).style("opacity", opacityScale(d.count)).style("transform", d => `translate(${d.x}px, ${d.y}px) scale(1)`);
                    d3.select(".word-tooltip").transition().duration(100).style("opacity", 0);
                });
        }
    }

    // --- STEP 2: FANTASY (Sunny Story) ---
    step2_SunnyFantasy() {
        this.showSlide(2);

        // Hide tooltip from word cloud
        this.tooltip.style("opacity", 0);

        // Optional: Animate stickers popping in?
        // Using CSS animations (already on .gif-sticker)
        // We can add a 'pop-in' class if we want, but straightforward is fine.

        // Ensure progress is updated
        this.updateProgress("2");

        // Clear any auto-timers from previous logic
        clearTimeout(this.autoNextTimer);
    }

    // --- STEP 3: REALITY ---
    step3_GrayReality() {
        clearTimeout(this.autoNextTimer);
        this.showSlide(3);
        console.log("Entering Step 3: Reality (Fog)");

        // Init Fog on Slide 3
        setTimeout(() => {
            const app = window.app;
            if (app && app.fog) {
                app.fog.initFog('intro-fog-layer');
            }
        }, 100);

        // Start Scratch Monitor
        this.startScratchMonitor();

        // Backup Button
        const btn = document.getElementById('intro-swipe-btn');
        if (btn) btn.onclick = () => {
            // If clicked, auto-clear
            this.navigate(1);
        };
    }

    // --- STEP 4: REAL STORY (Article) ---
    step4_Article() {
        clearTimeout(this.autoNextTimer);
        this.showSlide(4);
        console.log("Entering Step 4: Article");

        // Explicitly attach click handler to the card here
        const articleCard = document.getElementById('intro-article-card');
        if (articleCard) {
            articleCard.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.finish();
            };
        }
    }

    startScratchMonitor() {
        if (this.scratchInterval) clearInterval(this.scratchInterval);
        this.scratchInterval = setInterval(() => {
            if (window.app && window.app.fog) {
                const pct = window.app.fog.getScratchPercent();
                if (pct > 40) { // 40% cleared
                    console.log("Fog Cleared! Auto-Advancing to Slide 4.");
                    clearInterval(this.scratchInterval);
                    this.navigate(1); // Go to Slide 4
                }
            }
        }, 500);
    }

    finish() {
        if (this.isFinishing) return; // Prevent double triggering
        this.isFinishing = true;

        if (this.scratchInterval) clearInterval(this.scratchInterval);
        console.log("Intro Finished");
        localStorage.setItem('intro_completed', 'true');

        // --- FLY TO GRID ANIMATION ---
        const thumbnail = document.querySelector('.article-thumbnail');
        const cells = document.querySelectorAll('.hero-cell');

        // Pick a target cell (The first one)
        let targetCell = null;
        if (cells.length > 0) {
            targetCell = cells[0];
        }

        if (thumbnail && targetCell) {
            const startRect = thumbnail.getBoundingClientRect();
            const endRect = targetCell.getBoundingClientRect();
            const heroGrid = document.getElementById('hero-grid');

            // 1. Hide Target Cell (for flight illusion)
            targetCell.style.setProperty('opacity', '0', 'important');
            targetCell.style.transition = 'none';

            // 2. Hide ENTIRE Grid (User request: show AFTER flying)
            if (heroGrid) {
                heroGrid.style.transition = 'opacity 0.2s';
                heroGrid.style.opacity = '0'; // Disappear quickly

                // PREPARE STAGGER: Set all cells to opacity 0 instantly (except target?)
                // Actually, since grid is 0, we can set them safely now.
                cells.forEach(c => {
                    c.style.transition = 'none';
                    c.style.opacity = '0';
                });
            }

            const flyer = document.createElement('div');
            Object.assign(flyer.style, {
                position: 'fixed',
                top: `${startRect.top}px`,
                left: `${startRect.left}px`,
                width: `${startRect.width}px`,
                height: `${startRect.height}px`,
                backgroundImage: thumbnail.style.backgroundImage,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '20px',
                zIndex: '9999',
                pointerEvents: 'none',
                transition: 'all 1.0s cubic-bezier(0.25, 1, 0.5, 1)'
            });
            document.body.appendChild(flyer);

            // Reflow
            flyer.getBoundingClientRect();

            // Animate
            Object.assign(flyer.style, {
                top: `${endRect.top}px`,
                left: `${endRect.left}px`,
                width: `${endRect.width}px`,
                height: `${endRect.height}px`,
                borderRadius: '0px',
                opacity: '0.8'
            });

            // Fade Overlay
            this.container.style.transition = 'opacity 0.8s';
            this.container.style.opacity = '0';

            // Cleanup & Reveal
            setTimeout(() => {
                const app = window.app;

                // Reveal Grid Container
                if (heroGrid) {
                    heroGrid.style.transition = 'opacity 0.5s';
                    heroGrid.style.opacity = '1';
                }

                // Reveal Target
                targetCell.style.transition = 'opacity 0.5s';
                targetCell.style.setProperty('opacity', '1');

                // Staggered Reveal of Others
                cells.forEach(c => {
                    if (c === targetCell) return;
                    // Random delay
                    const delay = Math.random() * 1500;
                    c.style.transition = `opacity 1s ease-in ${delay}ms`;
                    // Force reflow
                    // void c.offsetWidth; 
                    // Actually, just setting style in timeout or relying on transition delay string works
                    // CSS transition-delay property is cleaner:

                    // But we disabled transition earlier. Re-enable.
                    // c.style.transition = 'opacity 1s'; 
                    // Better: use setTimeout to set opacity
                    setTimeout(() => {
                        c.style.transition = 'opacity 1s';
                        c.style.opacity = '0.8';
                    }, delay);
                });

                flyer.remove();
                this.container.style.display = 'none';
                this.container.style.opacity = '1';
                this.isFinishing = false;
            }, 1000);

        } else {
            // Fallback
            this.container.classList.add('slide-out');
            setTimeout(() => {
                this.container.style.display = 'none';
                this.isFinishing = false;
            }, 800);
        }
    }
}
