// --- DATASET PROCESSOR (Real Data) ---
class Dataset {
    constructor(rawData) {
        this.raw = rawData;
        this.process();
    }

    process() {
        // 1. Calculate Regional Monthly Means from 'socal_cloudmap_monthly'
        // This gives us the "Real Seasonality" curve
        const monthlyStats = {}; // { 1: {cloud, temp, sun}, 2: ... }

        console.log('Dataset: Processing data...', this.raw);
        console.log('Dataset: Has socal_cloudmap_monthly?', !!this.raw.socal_cloudmap_monthly);

        if (this.raw.socal_cloudmap_monthly) {
            this.raw.socal_cloudmap_monthly.forEach(record => {
                const m = record.month;
                if (!monthlyStats[m]) monthlyStats[m] = { c: [], t: [], s: [] };
                monthlyStats[m].c.push(record.clt);
                monthlyStats[m].t.push(record.tas);
                monthlyStats[m].s.push(record.rsds);
            });
        }

        // Average them out
        const regionalMeans = [];
        for (let m = 1; m <= 12; m++) {
            if (monthlyStats[m]) {
                const c = monthlyStats[m].c.reduce((a, b) => a + b, 0) / monthlyStats[m].c.length;
                const t = monthlyStats[m].t.reduce((a, b) => a + b, 0) / monthlyStats[m].t.length;
                const s = monthlyStats[m].s.reduce((a, b) => a + b, 0) / monthlyStats[m].s.length;
                // Convert units:
                // CLT is %, TAS is Kelvin, RSDS is W/m2
                regionalMeans[m] = {
                    cloud: c / 100, // 0-1
                    temp: (t - 273.15) * 9 / 5 + 32, // K -> F
                    solar: s / 300 // Normalize approx max 300?
                };
            } else {
                regionalMeans[m] = { cloud: 0.5, temp: 70, solar: 0.5 }; // Fallback
            }
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
