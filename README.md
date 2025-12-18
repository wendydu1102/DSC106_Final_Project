# Sunny Cloudy SoCal ⛅

**Is SoCal really sunny?** A data visualization project exploring the truth behind the "Sunny SoCal" stereotype.

## Motivation

Southern California is often marketed to the world as a paradise of perfect weather—endless sunshine, palm trees, and beaches. But for the millions of people living along the coast, the reality is frequently different. From "May Gray" to "June Gloom," "No-Sky July," and even "Fogust," the region is often blanketed in a persistent marine layer that creates a stark contrast to the "Sunny SoCal" stereotype.

This project aims to answer the question, **"Is SoCal really sunny?"** by stripping away the marketing and looking at the raw data. We analyzed and processed 365 days of NOAA GOES-16 satellite imagery from 2023 to visualize the actual weather patterns, quantifying just how often the clouds obscure the sun and how these patterns manifest across different times of day and seasons.

## Features

### 1. The Cloud Calendar
A scrollytelling visual narrative that takes you through the year 2023.
-   **Morning vs. Afternoon**: Compare the view from space at 8:00 AM versus 2:00 PM to see how the marine layer burns off (or doesn't).
-   **Seasonal Analysis**: visualizes key weather phenomena including Winter Storms, the onset of May Gray, the June Peak of Gloom, and the "Second Summer" in September/October.

### 2. The Satellite Archive
An interactive exploration tool giving you control over the entire 2023 dataset.
-   **Timeline Scrubber**: Drag through the year to observe daily cloud patterns.
-   **Comparisons**: Toggle between morning, afternoon, and comparison modes.
-   **Deep Dives**: Analyze specific days in high resolution to see detailed marine layer behavior.
-   **Time-Lapse**: Watch the entire year's cloud cover evolve in a cinematic playback.

### 3. The Secret Behind the Gray (Mechanism)
An interactive educational section that explains *why* the gloom happens.
-   **Physics of Fog**: Learn about the temperature inversion "lid" that traps cool ocean air beneath warm layers.
-   **Interactive Simulation**: Use a slider to simulate the "burn-off" effect, visualizing how rising temperatures mix the air and evaporate the fog.

### 4. Climate Seasonality
Moving beyond just one year, this section uses long-term climate models to provide context.
-   **Historical & Future Data**: Analyzes 24 years of CMIP6 historical data (1990-2014) and projections through 2100.
-   **Variables**: Explore seasonal distributions of Clouds, Temperature, Wind Speed, Solar Radiation, and Air Pressure.

### 5. Location Optimizer
A personalized tool to help you find your ideal microclimate.
-   **Preference Weights**: Adjust sliders for Solar Importance, Cloud Sensitivity, and Heat Aversion.
-   **Leaderboard**: See which SoCal cities rank highest based on your personal "Good Weather" definition.
-   **Map Visualization**: Explore the rankings geographically across the region.

### 6. Real-time Clouds
See what is happening right now with a live feed of the Pacific Southwest.
-   **Live Data**: Displays the latest 4-hour GOES-18 GeoColor satellite loop, updated every 30 minutes.

## Data Sources
-   **NOAA GOES-16/18**: Satellite imagery for 2023 analysis and real-time feeds.
-   **CMIP6**: Climate model intercomparison project data for historical and future trends.
-   **OpenStreetMap & Mapbox**: Geospatial data for mapping visualizations.
