
// Real-time Cloud GIF Logic
// Fetches the latest GOES-18 animated loop from NOAA

async function updateGif() {
    const dir = "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/psw/GEOCOLOR/";

    try {
        const res = await fetch(dir, { cache: "no-store" });
        const html = await res.text();

        // Grab all GIF filenames that look like the PSW GeoColor loop
        // The pattern provided by user: href="...GEOCOLOR...600x600.gif"
        const matches = [...html.matchAll(/href="([^"]+GEOCOLOR[^"]+600x600\.gif)"/g)];

        if (!matches.length) {
            console.warn("No GIFs found in directory listing");
            return;
        }

        // Latest file is usually the last one in the list
        const latest = matches[matches.length - 1][1];

        const img = document.getElementById("psw-loop");
        if (img) {
            img.src = dir + latest + "?ts=" + Date.now(); // cache-buster
            console.log("Updated GOES loop to:", img.src);
        } else {
            console.warn("Element #psw-loop not found");
        }
    } catch (err) {
        console.error("Failed to update GOES loop", err);
    }
}

// Run once on load
// Ensure DOM is ready or run immediately if script is at bottom
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateGif);
} else {
    updateGif();
}

// Refresh every 10 minutes
setInterval(updateGif, 10 * 60 * 1000);
