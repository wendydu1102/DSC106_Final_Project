class SectionNavigator {
    constructor() {
        this.container = document.getElementById('section-navigator');
        // Define sections to track. MUST match ID in HTML.
        // Define sections to track. MUST match ID in HTML.
        this.sections = [
            { id: 'hero-section', label: 'Intro', level: 1 },
            { id: 'part1-header', label: 'Part 1: Satellite Records', level: 1 },
            { id: 'cloud-wall-section', label: 'Cloud Calendar', level: 2 },
            { id: 'cloud-playground', label: 'Satellite Archive', level: 2 },
            { id: 'mechanism-section', label: 'Mechanism', level: 2 },
            { id: 'part2-header', label: 'Part 2: Climate Projection', level: 1 },
            { id: 'climate-lab', label: 'Seasonality', level: 2 },
            { id: 'city-playground', label: 'City Ranker', level: 2 },
            { id: 'today-clouds', label: 'Live View', level: 2 }
        ];

        this.init();
    }

    init() {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.sections.forEach(section => {
            const dot = document.createElement('div');
            dot.className = 'nav-dot';
            dot.dataset.target = section.id;

            dot.dataset.level = section.level;

            const label = document.createElement('div');
            label.className = 'nav-label';
            label.textContent = section.label;

            dot.appendChild(label);

            dot.addEventListener('click', () => {
                const targetEl = document.getElementById(section.id) || document.querySelector(`.${section.id}`);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            });

            this.container.appendChild(dot);
        });

        this.observeSections();
    }

    observeSections() {
        // "Center Line" tracking:
        // Use a negative rootMargin to shrink the observer viewport to a thin strip in the middle.
        // This ensures the active section is the one currently occupying the center of the screen.
        const observerOptions = {
            root: null,
            rootMargin: '-45% 0px -45% 0px',
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.setActive(entry.target.id);
                }
            });
        }, observerOptions);

        this.sections.forEach(section => {
            const el = document.getElementById(section.id);
            if (el) observer.observe(el);
        });
    }

    setActive(id) {
        const dots = this.container.querySelectorAll('.nav-dot');
        dots.forEach(dot => {
            if (dot.dataset.target === id) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }
}
