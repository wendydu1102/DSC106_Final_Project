class CityRanker {
    constructor(data) {
        this.data = data;
        this.weights = { sun: 50, cloud: 70, heat: 30 };
        this.listContainer = document.getElementById('city-list');

        mapboxgl.accessToken = CONFIG.mapboxToken;
        this.map = new mapboxgl.Map({
            container: 'city-map-container',
            style: 'mapbox://styles/mapbox/light-v10',
            center: [-118.5, 33.8],
            zoom: 7,
            minZoom: 6.5,
            maxZoom: 12,
            maxBounds: [
                [-122, 32], // Southwest coordinates
                [-114, 35.5] // Northeast coordinates
            ],
            scrollZoom: true // Enable scroll zoom but constrained
        });

        this.map.on('load', () => this.initMap());

        this.popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15
        });

        // Initialize Search Interface
        this.initSearch();
    }

    initMap() {
        this.map.resize();

        this.map.addSource('cities', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        this.map.addLayer({
            id: 'cities-layer',
            type: 'circle',
            source: 'cities',
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'score'],
                    0, 4,
                    100, 8,
                    300, 20
                ],
                'circle-color': [
                    'case',
                    ['<=', ['get', 'rank'], 3], '#f4d03f',
                    '#2c3e50'
                ],
                'circle-opacity': 0.8,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        this.map.on('mouseenter', 'cities-layer', (e) => {
            this.map.getCanvas().style.cursor = 'pointer';
            this.showPopup(e);
        });
        this.map.on('mouseleave', 'cities-layer', () => {
            this.map.getCanvas().style.cursor = '';
            this.popup.remove();
        });
        this.map.on('mousemove', 'cities-layer', (e) => this.showPopup(e));

        this.map.on('click', 'cities-layer', (e) => {
            if (e.features.length) {
                const feature = e.features[0];
                const coords = feature.geometry.coordinates;
                this.map.flyTo({ center: coords, zoom: 10 });

                // Show standard popup
                new mapboxgl.Popup({ offset: 15, closeButton: false })
                    .setLngLat(coords)
                    .setHTML(this.getPopupHTML(feature.properties.name, feature.properties.score, feature.properties.rank))
                    .addTo(this.map);
            }
        });

        this.updateView();
    }

    showPopup(e) {
        if (!e.features.length) return;
        const feature = e.features[0];

        const html = this.getPopupHTML(feature.properties.name, feature.properties.score, feature.properties.rank);



        this.popup.setLngLat(feature.geometry.coordinates)
            .setHTML(html)
            .addTo(this.map);
    }

    updateWeight(type, val) {
        this.weights[type] = parseInt(val);
        const labelEl = document.getElementById(`val-${type}`);
        if (labelEl) {
            if (type == 'cloud') labelEl.textContent = `Penalty: ${val}`;
            else if (type == 'heat') labelEl.textContent = `Avoid: ${val}`;
            else labelEl.textContent = `${val}`;
        }
        this.updateView();
    }

    calculateScore(city) {
        const avgCloud = city.stats.avgCloud;
        const avgTemp = city.stats.avgTemp;
        const avgSun = city.stats.avgSun;
        const tempScore = Math.max(0, 1 - ((avgTemp - 65) / 30));

        const sSun = (avgSun * this.weights.sun);
        const sCloud = ((1 - avgCloud) * this.weights.cloud);
        const sHeat = (tempScore * this.weights.heat);

        return Math.floor(sSun + sCloud + sHeat + 50);
    }

    updateView() {
        const scores = [];
        if (!this.data.cities) return;

        Object.values(this.data.cities).forEach(city => {
            scores.push({
                city: city,
                score: this.calculateScore(city)
            });
        });

        scores.sort((a, b) => b.score - a.score);

        this.listContainer.innerHTML = '';
        scores.forEach((item, i) => {
            const rank = i + 1;
            item.rank = rank;

            const card = document.createElement('div');
            card.className = 'city-card';
            card.innerHTML = `
                <div class="city-rank ${rank <= 3 ? 'top-3' : ''}">#${rank}</div>
                <div class="city-name">${item.city.name}</div>
                <div class="city-score">${item.score}</div>
            `;
            // Add click to fly
            card.onclick = () => {
                if (this.map) this.map.flyTo({ center: [item.city.lon, item.city.lat], zoom: 9 });
            };
            this.listContainer.appendChild(card);
        });

        if (this.map && this.map.getSource('cities')) {
            const features = scores.map(item => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [item.city.lon, item.city.lat]
                },
                properties: {
                    name: item.city.name,
                    score: item.score,
                    rank: item.rank
                }
            }));

            this.map.getSource('cities').setData({
                type: 'FeatureCollection',
                features: features
            });
        }
    }

    initSearch() {
        const input = document.getElementById('city-search-input');
        const list = document.getElementById('city-search-results');
        const clearBtn = document.getElementById('search-clear-btn');

        if (!input || !list) return;

        const showAllCities = () => {
            const allCities = Object.values(this.data.cities).sort((a, b) => a.name.localeCompare(b.name));
            this.renderSearchResults(allCities, list);
        };

        // Focus Handler - Show all
        input.addEventListener('focus', () => {
            if (input.value.trim().length === 0) {
                showAllCities();
            } else {
                // If there's value, trigger input logic
                input.dispatchEvent(new Event('input'));
            }
        });

        // Input Handler
        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();

            // Toggle clear button
            if (clearBtn) clearBtn.style.display = query.length > 0 ? 'flex' : 'none';

            if (query.length < 1) {
                showAllCities(); // Show all instead of hiding
                return;
            }

            // Filter
            const matches = Object.values(this.data.cities).filter(city =>
                city.name.toLowerCase().includes(query)
            );

            this.renderSearchResults(matches, list);
        });

        // Clear Button Handler
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                input.value = '';
                showAllCities(); // Keep dropdown open with all cities
                clearBtn.style.display = 'none';
                input.focus();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !list.contains(e.target)) {
                list.style.display = 'none';
            }
        });
    }

    renderSearchResults(matches, listContainer) {
        listContainer.innerHTML = '';

        if (matches.length === 0) {
            listContainer.style.display = 'none';
            return;
        }

        // No slice limit, show all matches (scrolling handled by CSS)
        // const topMatches = matches.slice(0, 8); 

        matches.forEach(city => {
            const li = document.createElement('li');
            li.textContent = city.name;
            li.onclick = () => {
                this.selectCity(city);
                listContainer.style.display = 'none';
            };
            listContainer.appendChild(li);
        });

        listContainer.style.display = 'block';
    }

    selectCity(city) {
        const input = document.getElementById('city-search-input');
        if (input) input.value = city.name;

        // Show clear button since value is populated
        const clearBtn = document.getElementById('search-clear-btn');
        if (clearBtn) clearBtn.style.display = 'flex';

        if (this.map) {
            this.map.flyTo({
                center: [city.lon, city.lat],
                zoom: 11,
                essential: true
            });

            // Trigger popup with standardized HTML
            const cityData = this.data.cities[city.name];
            // Calculate rank dynamically (it might change with filters)
            // But selectCity receives 'city' object which is raw data, need rank
            // The score is re-calc'd, so let's calc score. Rank is tough without full sort.
            // Simplified: use score.

            const score = this.calculateScore(city);

            new mapboxgl.Popup({ offset: 15, closeButton: false })
                .setLngLat([city.lon, city.lat])
                .setHTML(this.getPopupHTML(city.name, score, null)) // Pass null for rank if unknown
                .addTo(this.map);
        }
    }

    getPopupHTML(cityName, score, rank) {
        const cityData = this.data.cities[cityName];
        if (!cityData) return '';

        const sunnyPct = Math.round(cityData.stats.avgSun * 100);
        const cloudPct = Math.round(cityData.stats.avgCloud * 100);
        const temp = Math.round(cityData.stats.avgTemp);
        const rankHtml = rank ? ` (Rank #${rank})` : '';

        return `
            <div class="popup-city">${cityName}</div>
            <div class="popup-score">Score: <strong>${score}</strong>${rankHtml}</div>
            <div class="popup-detail">
                <div class="popup-stat">Sun: ${sunnyPct}%</div>
                <div class="popup-stat">Cloud: ${cloudPct}%</div>
                <div class="popup-stat" style="grid-column: span 2;">Temp: ${temp}°F</div>
            </div>
        `;
    }
}

// --- SECTION 1: FOG HOOK ---
