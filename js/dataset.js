// --- DATASET PROCESSOR (Real Data) ---
class Dataset {
    constructor(rawData) {
        this.raw = rawData;
        this.process();
    }

    process() {
        // 1. Calculate Regional Monthly Means (Spatial Average)
        // Structure: { scenario: { month: { cloud, temp, sun, pressure, wind } } }
        this.climatology = { historical: {}, ssp245: {}, ssp585: {} };

        const scenarios = {
            historical: this.raw.socal_cloudmap_monthly,
            future: this.raw.future_socal_cloudmap_monthly
        };

        const aggregator = { historical: {}, ssp245: {}, ssp585: {} };

        // Helper to init month
        const initMonth = (scen, m) => {
            if (!aggregator[scen][m]) aggregator[scen][m] = { c: [], t: [], s: [], p: [], w: [] };
        };

        // Process Historical
        if (scenarios.historical) {
            scenarios.historical.forEach(d => {
                initMonth('historical', d.month);
                aggregator['historical'][d.month].c.push(d.clt);
                aggregator['historical'][d.month].t.push(d.tas);
                aggregator['historical'][d.month].s.push(d.rsds);
                if (d.psl) aggregator['historical'][d.month].p.push(d.psl);
                if (d.sfcWind) aggregator['historical'][d.month].w.push(d.sfcWind);
            });
        }

        // Process Future
        if (scenarios.future) {
            scenarios.future.forEach(d => {
                const scen = d.scenario; // 'ssp245' or 'ssp585'
                if (aggregator[scen]) {
                    initMonth(scen, d.month);
                    aggregator[scen][d.month].c.push(d.clt);
                    aggregator[scen][d.month].t.push(d.tas);
                    aggregator[scen][d.month].s.push(d.rsds);
                    if (d.psl) aggregator[scen][d.month].p.push(d.psl);
                    if (d.sfcWind) aggregator[scen][d.month].w.push(d.sfcWind);
                }
            });
        }

        // Compute Averages
        ['historical', 'ssp245', 'ssp585'].forEach(scen => {
            for (let m = 1; m <= 12; m++) {
                const data = aggregator[scen][m];
                if (data && data.c.length > 0) {
                    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

                    this.climatology[scen][m] = {
                        cloud: avg(data.c),      // % (0-100) 
                        cloudPct: avg(data.c),  // Store 0-100 for display convenience
                        clt: avg(data.c),       // Alias to match raw variable name (User Req)
                        temp: (avg(data.t) - 273.15) * 9 / 5 + 32, // K -> F
                        solar: avg(data.s),     // W/m2
                        pressure: avg(data.p) / 100, // Pa -> hPa (mb)
                        wind: avg(data.w) * 2.23694 // m/s -> mph
                    };

                    // Normalize Cloud to 0-1 for existing synthesis logic
                    this.climatology[scen][m].cloudFraction = this.climatology[scen][m].clt / 100;

                } else {
                    // Fallback
                    this.climatology[scen][m] = { cloud: 50, cloudPct: 50, clt: 50, cloudFraction: 0.5, temp: 70, solar: 200, pressure: 1013, wind: 5 };
                }
            }
        });

        // Use Historical for the synth loop below to maintain current app behavior
        const regionalMeans = {};
        for (let m = 1; m <= 12; m++) {
            regionalMeans[m] = {
                cloud: this.climatology.historical[m].cloudFraction,
                temp: this.climatology.historical[m].temp,
                solar: this.climatology.historical[m].solar / 300 // Legacy normalization for synth noise
            };
        }

        // 2. Use Real Daily Cloud Data from REAL_CLOUD_DATA
        // Combine with synthesized temp/solar based on monthly means
        this.days = [];
        const startDate = new Date(2023, 0, 1);

        console.log('Dataset: Using REAL_CLOUD_DATA?', typeof REAL_CLOUD_DATA !== 'undefined');

        for (let i = 0; i < 365; i++) {
            const current = new Date(startDate);
            current.setDate(startDate.getDate() + i);
            const m = current.getMonth() + 1;
            const stats = regionalMeans[m];

            // Format date as YYYY-MM-DD for lookup
            const dateStr = current.toISOString().split('T')[0];

            // Get real cloud data if available
            let amCloud = 0.5; // fallback
            let pmCloud = 0.5; // fallback

            if (typeof REAL_CLOUD_DATA !== 'undefined' && REAL_CLOUD_DATA[dateStr]) {
                const realData = REAL_CLOUD_DATA[dateStr];
                amCloud = realData.morning !== undefined ? realData.morning : 0.5;
                pmCloud = realData.afternoon !== undefined ? realData.afternoon : 0.5;
            } else {
                // Fallback to synthesized if real data not available
                const noise = () => (Math.random() - 0.5) * 0.2;
                amCloud = stats.cloud + noise();
                pmCloud = stats.cloud + noise();

                // June gloom logic for fallback
                if (m === 5 || m === 6) {
                    amCloud += 0.3;
                    pmCloud -= 0.1;
                }
                amCloud = Math.max(0, Math.min(1, amCloud));
                pmCloud = Math.max(0, Math.min(1, pmCloud));
            }

            // Synthesize temp and solar with noise (keep this synthetic for variation)
            const noise = () => (Math.random() - 0.5) * 0.2;

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
