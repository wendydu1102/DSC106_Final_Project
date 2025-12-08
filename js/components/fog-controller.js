class FogController {
    constructor() {
        // Defer everything to initFog
        this.canvas = null;
        this.ctx = null;
    }

    initFog(containerId) {
        // If containerId provided, append canvas there
        if (containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;

            // Check if canvas already exists
            this.canvas = container.querySelector('canvas');
            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
                this.canvas.style.position = 'absolute';
                this.canvas.style.top = '0';
                this.canvas.style.left = '0';
                this.canvas.style.width = '100%';
                this.canvas.style.height = '100%';
                container.appendChild(this.canvas);
            }
        } else {
            // Fallback to old global ID if checking Hero (though we are removing Hero usage)
            this.canvas = document.getElementById('fog-overlay');
        }

        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.resize();

        // Listeners
        window.addEventListener('resize', () => {
            this.resize();
            this.drawFog();
        });

        this.canvas.addEventListener('mousemove', (e) => this.scratch(e));
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.scratch(e.touches[0]);
        }, { passive: false });

        this.drawFog();
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.drawFog(); // Ensure redraw on resize
    }

    drawFog() {
        if (!this.canvas || !this.ctx) return;
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

    // Calculate percentage of transparent pixels
    getScratchPercent() {
        if (!this.canvas || !this.ctx) return 0;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Optimization: Create a small offscreen canvas or just sample?
        // Sampling is faster. Let's sample 100x100 grid points.
        const samples = 400; // 20x20 grid
        let cleared = 0;

        try {
            // Getting full image data is heavy (Width*Height*4 bytes). 
            // Better to just grab 1 pixel at intervals? 
            // getImageData is slow if called constantly.
            // Let's do a full check but only call it when needed?
            // User requested smooth storyline.
            // Let's stick to simple area heuristic or exact calculation throttled.

            // Actually, we can just return a rough estimate based on mouse moves?
            // No, pixel data is accurate.
            // Let's downsample: Resize draw to small canvas?

            // Simplest robust way: 
            const imageData = this.ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            let transparentPixels = 0;
            const totalPixels = data.length / 4;

            // Check every 30th pixel to speed up (stride)
            const stride = 30; // Check 1 pixel every 30
            let checked = 0;

            for (let i = 0; i < totalPixels; i += stride) {
                if (data[i * 4 + 3] < 128) { // Alpha < 50%
                    transparentPixels++;
                }
                checked++;
            }

            return (transparentPixels / checked) * 100;

        } catch (e) {
            console.warn("Fog pixel read failed (CORS?):", e);
            return 0;
        }
    }
}
