// --- SECTION 1: HERO GRID ---
class HeroGrid {
    constructor() {
        this.container = document.getElementById('hero-grid');
        this.init();
    }

    init() {
        if (!this.container) return;
        this.container.innerHTML = ''; // Clear existing

        // We have GOES_IMAGES global from data/goes_images_index.js
        if (typeof GOES_IMAGES === 'undefined') {
            console.warn("HeroGrid: GOES_IMAGES data not found.");
            return;
        }

        console.log('HeroGrid: GOES_IMAGES exists', GOES_IMAGES);
        console.log('HeroGrid: GOES_IMAGES.goesImages exists?', !!GOES_IMAGES.goesImages);

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

        console.log(`HeroGrid: Found ${days.length} morning satellite images`);

        // Limit to reasonable number for performance if needed, but 365 is fine.
        // Create cells
        // Limit to reasonable number for performance if needed, but 365 is fine.
        // OPTIMIZATION: Progressive Loading (Batching) to prevent UI freeze
        const BATCH_SIZE = 15;
        let index = 0;

        const loadBatch = () => {
            const end = Math.min(index + BATCH_SIZE, days.length);

            for (let i = index; i < end; i++) {
                const path = days[i];
                const cell = document.createElement('div');
                cell.className = 'hero-cell';
                const relPath = `${path}`;
                cell.style.backgroundImage = `url('${relPath}')`;

                // Staggered animation on load
                cell.style.opacity = 0;
                setTimeout(() => {
                    cell.style.opacity = 0.8;
                }, (i - index) * 50 + 100); // Local stagger per batch

                this.container.appendChild(cell);
            }

            index = end;
            if (index < days.length) {
                // Continue next batch in next frame
                requestAnimationFrame(loadBatch);
            } else {
                console.log("HeroGrid: All images loaded.");
            }
        };

        // Start loading
        loadBatch();
    }
}
