// --- INIT ---
window.app = {
    init: () => { }
};

// Alias for local use if needed, though window.app is safer
const app = window.app;

document.addEventListener('DOMContentLoaded', () => {
    console.log('=== App Initialization Starting (DOMContentLoaded) ===');

    // Check if all classes are defined
    console.log('Dataset defined?', typeof Dataset !== 'undefined');
    console.log('CloudWall defined?', typeof CloudWall !== 'undefined');
    console.log('CloudPlayground defined?', typeof CloudPlayground !== 'undefined');
    console.log('GloomScatter defined?', typeof GloomScatter !== 'undefined');
    console.log('CityRanker defined?', typeof CityRanker !== 'undefined');
    console.log('FogController defined?', typeof FogController !== 'undefined');
    console.log('HeroGrid defined?', typeof HeroGrid !== 'undefined');
    console.log('ClimateLab defined?', typeof ClimateLab !== 'undefined');

    try {
        // Process Data
        console.log('Creating Dataset...');
        const processedData = new Dataset(SOCAL_DATA);
        app.data = processedData;
        console.log('Dataset created successfully');

        console.log('Creating CloudWall...');
        app.cloudWall = new CloudWall(processedData);

        console.log('Creating CloudPlayground...');
        app.playground = new CloudPlayground(processedData);

        console.log('Creating GloomScatter...');
        app.gloom = new GloomScatter(processedData);

        console.log('Creating CityRanker...');
        app.cities = new CityRanker(processedData);

        // Interactive Fog
        console.log('Creating FogController...');
        app.fog = new FogController();

        // Initialize new Navigator
        app.navigator = new SectionNavigator();

        // Intro Hook
        console.log('Creating IntroHook...');
        if (typeof IntroHook !== 'undefined') {
            app.introHook = new IntroHook();
        }

        // Background Grid
        console.log('Creating HeroGrid...');
        app.hero = new HeroGrid();

        // Quick Init for Lab if needed
        console.log('Creating ClimateLab...');
        app.lab = new ClimateLab(processedData);

        // Mechanism Section
        console.log('Creating MechanismViz...');
        // Check if MechanismViz exists (it should since we added the script)
        if (typeof MechanismViz !== 'undefined') {
            app.mechanism = new MechanismViz(processedData);
        } else {
            console.warn('MechanismViz class not found!');
        }

        console.log('=== App Initialization Complete ===');
        console.log('app.lab exists?', !!app.lab);
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
});
