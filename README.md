# Sunny Cloudy SoCal ⛅

Hi! Welcome to **Sunny Cloudy SoCal**, a data visualization project designed to answer one question: **Is SoCal actually sunny?**

## Motivation

Everyone thinks Southern California is always sunny. We see it in movies and ads—palm trees and blue skies. But if you live on the coast, you know about "May Gray" and "June Gloom." It actually gets pretty cloudy.

I wanted to see what the data says. Instead of just guessing, I processed 365 days of satellite images from 2023 to visualize the real weather patterns. This project compares the "sunny" stereotype with the reality.

## Features

### 1. Instagram Intro
The site starts with an interactive story that feels like Instagram. You can answer a quick question about SoCal and then "scratch" off the fog on a photo to reveal what the satellite actually saw that day.

### 2. The Cloud Calendar
This is a visual story of 2023. You can scroll through the year and compare the view at 8:00 AM (usually cloudy) vs. 2:00 PM (usually sunny) to see how the marine layer burns off.

### 3. The Satellite Archive
This is the main interactive tool. You can play around with the data yourself:
-   **Timeline**: Drag a slider to see cloud patterns for any day in 2023.
-   **Compare Mode**: See morning and afternoon side-by-side.
-   **Deep Dives**: Zoom into specific days to see the details.
-   **Time-Lapse**: Watch a video of the clouds moving across the whole year.

### 4. How It Works (The Mechanism)
Why is it so gloomy in June? This section explains the science, like how warm air traps the cool ocean air (temperature inversion). There is an interactive slider where you can simulate the sun burning off the fog.

### 5. Climate Data
Looking beyond just 2023, this section uses long-term climate models (past and future) to show seasonal trends for clouds, temperature, and wind.

### 6. Location Finder
If you are looking for a place to live, this tool ranks SoCal cities based on your preferences. You can adjust sliders for how much you like sun, heat, or clouds, and it will show you the best match.

### 7. Real-Time Feed
See what's happening right now. This connects to a live satellite feed so you can see the latest cloud cover over the coast.

## Data Sources
-   **NOAA GOES-16/18**: For the satellite images.
-   **CMIP6**: For the climate data.
-   **OpenStreetMap & Mapbox**: For the maps.
