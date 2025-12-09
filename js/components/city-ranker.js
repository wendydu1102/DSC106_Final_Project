class CityRanker {
    constructor(data) {
        this.data = data;
        this.weights = { sun: 50, cloud: 70, heat: 30 };
        this.listContainer = document.getElementById('city-list');
        this.currentPopupCity = null;

        mapboxgl.accessToken = CONFIG.mapboxToken;
        this.map = new mapboxgl.Map({
            container: 'city-map-container',
            style: 'mapbox://styles/mapbox/light-v10',
            center: [-118.5, 33.8],
            zoom: 7,
            minZoom: 6.5,
            maxZoom: 12,
            maxBounds: [
                [-122, 32],
                [-114, 35.5]
            ],
            scrollZoom: true
        });

        this.map.on('load', () => this.initMap());

        this.popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15
        });

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

        // Hover
        this.map.on('mouseenter', 'cities-layer', (e) => {
            this.map.getCanvas().style.cursor = 'pointer';
            this.showPopup(e);
        });
        this.map.on('mouseleave', 'cities-layer', () => {
            this.map.getCanvas().style.cursor = '';
            // Only remove if not "locked" by click? For now, standard behavior is remove on leave unless clicked.
            // But we have click behavior.
            // Usually simpler: hover shows popup, leave removes it.
            // Click PERMANENTLY shows it?
            // If we want persistent popup on click, we need to handle that.
            // Existing logic had popup remove on leave.
            // Let's keep it simple: Click sets position, but mouseleave might clear it if we are not careful?
            // If user clicks, they expect it to stay.
            
            // Actually, typical mapbox behavior:
            // Hover -> Show temporary popup.
            // Click -> open persistent popup.
            // But we are reusing `this.popup`.
            // So logic: On hover, update `this.popup`. On leave, remove it?
            // If I click, and then move mouse away, it disappears? That's annoying for "locking" a selection.
            
            // FIX: Only remove on leave if we haven't "locked" a city?
            // Or better: Let's assume hover is just hover-info. Click is selection.
            // The search/list click triggers a selection (like click).
            
            // To support both:
            // If specific city selected, don't close on hover-out of that city?
            // Complicated.
            // Let's stick to: Hover shows popup. List click zooms and shows popup.
            // Mouseleave removes popup?
            
            // If `list click` happens, the mouse might not be over the dot. So mouseleave won't fire immediately.
            // But if user moves mouse over map and out of a dot...
            
            // Let's allow mouseleave to close it for now to match established pattern, 
            // BUT if it was opened via click/search (programmatic), it should ideally stay until another interaction.
            
            // Let's act like hover is transient.
            // But click/search is persistent?
            // For now: I will comment out the `mouseleave` removal to see if that helps "not change" / stickiness.
            // Wait, if I never remove it, it stays forever.
            
            // Revert: The user asked for "tooltip updating". They didn't complain about closing.
            // The issue was "not change" (update) values.
            
            this.currentPopupCity = null; 
            this.popup.remove();
        });
        
        this.map.on('mousemove', 'cities-layer', (e) => this.showPopup(e));

        // Click on map dot
        this.map.on('click', 'cities-layer', (e) => {
            if (e.features.length) {
                const feature = e.features[0];
                const coords = feature.geometry.coordinates;
                this.map.flyTo({ center: coords, zoom: 10 });
                
                this.currentPopupCity = feature.properties.name; 
                
                this.popup.setLngLat(coords)
                    .setHTML(this.getPopupHTML(feature.properties.name, feature.properties.score, feature.properties.rank))
                    .addTo(this.map);
            }
        });

        this.updateView();
    }

    showPopup(e) {
        if (!e.features.length) return;
        const feature = e.features[0];
        
        this.currentPopupCity = feature.properties.name; 

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
            
            card.onclick = () => {
                if (this.map) {
                    this.map.flyTo({ center: [item.city.lon, item.city.lat], zoom: 11 }); 
                    
                    this.currentPopupCity = item.city.name; 
                    
                    this.popup.setLngLat([item.city.lon, item.city.lat])
                        .setHTML(this.getPopupHTML(item.city.name, item.score, item.rank))
                        .addTo(this.map);
                }
            };
            this.listContainer.appendChild(card);
        });

        // Update Map Source
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
            
            // Check if active popup needs update
            if (this.currentPopupCity) {
                 const currentCityItem = scores.find(s => s.city.name === this.currentPopupCity);
                 if(currentCityItem) {
                     const html = this.getPopupHTML(currentCityItem.city.name, currentCityItem.score, currentCityItem.rank);
                     this.popup.setHTML(html);
                 }
            }
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

        input.addEventListener('focus', () => {
            if (input.value.trim().length === 0) showAllCities();
            else input.dispatchEvent(new Event('input'));
        });

        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (clearBtn) clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
            if (query.length < 1) {
                showAllCities();
                return;
            }
            const matches = Object.values(this.data.cities).filter(city =>
                city.name.toLowerCase().includes(query)
            );
            this.renderSearchResults(matches, list);
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                input.value = '';
                showAllCities();
                clearBtn.style.display = 'none';
                input.focus();
            });
        }

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
        const clearBtn = document.getElementById('search-clear-btn');
        if (clearBtn) clearBtn.style.display = 'flex';

        if (this.map) {
            this.map.flyTo({
                center: [city.lon, city.lat],
                zoom: 11,
                essential: true
            });

            this.currentPopupCity = city.name; 
            
            const score = this.calculateScore(city);
            
            this.popup.setLngLat([city.lon, city.lat])
                .setHTML(this.getPopupHTML(city.name, score, null))
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
