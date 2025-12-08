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
            scrollZoom: false
        });

        this.map.on('load', () => this.initMap());

        this.popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15
        });
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
                const coords = e.features[0].geometry.coordinates;
                this.map.flyTo({ center: coords, zoom: 10 });
            }
        });

        this.updateView();
    }

    showPopup(e) {
        if (!e.features.length) return;
        const feature = e.features[0];

        const cityData = this.data.cities[feature.properties.name];
        const sunnyPct = cityData ? Math.round(cityData.stats.avgSun * 100) : 50;
        const cloudPct = cityData ? Math.round(cityData.stats.avgCloud * 100) : 50;
        const temp = cityData ? Math.round(cityData.stats.avgTemp) : 70;

        const html = `
            <div class="popup-city">${feature.properties.name}</div>
            <div class="popup-score">Score: <strong>${feature.properties.score}</strong> (Rank #${feature.properties.rank})</div>
            <div class="popup-detail">
                <div class="popup-stat">Sun: ${sunnyPct}%</div>
                <div class="popup-stat">Cloud: ${cloudPct}%</div>
                <div class="popup-stat" style="grid-column: span 2;">Temp: ${temp}°F</div>
            </div>
        `;

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
}

// --- SECTION 1: FOG HOOK ---
