import json
import re

def process_data():
    # 1. Read the JS data file
    with open('data/data.js', 'r') as f:
        content = f.read()
    
    # Extract the JSON object content
    # Look for "const SOCAL_DATA = {" and the end
    match = re.search(r'const SOCAL_DATA = ({.*});', content, re.DOTALL)
    if not match:
        print("Could not parse data.js")
        return

    raw_json_str = match.group(1)
    # The keys in the JS file might not be quoted (e.g. city_sunnyscore: [...]). 
    # Python's json parser requires quoted keys.
    # We might need a loose parser or just regex fix.
    # Looking at the `view_file` output from step 127/137, the keys ARE quoted (e.g. "city_sunnyscore").
    # So standard JSON load might work if we ensure strict syntax.
    
    try:
        data = json.loads(raw_json_str)
    except json.JSONDecodeError as e:
        print(f"JSON Parse Error: {e}")
        # fallback: try to fix common issues if strict parsing fails, 
        # but the file looked valid in previous turn.
        return

    # 2. Aggregation Logic
    climatology = {'historical': {}, 'ssp245': {}, 'ssp585': {}}
    aggregator = {'historical': {}, 'ssp245': {}, 'ssp585': {}}

    def init_month(scen, m):
        if m not in aggregator[scen]:
            aggregator[scen][m] = {'c': [], 't': [], 's': [], 'p': [], 'w': []}

    # Process Historical
    for d in data.get('socal_cloudmap_monthly', []):
        m = d['month']
        init_month('historical', m)
        aggregator['historical'][m]['c'].append(d['clt'])
        aggregator['historical'][m]['t'].append(d['tas'])
        aggregator['historical'][m]['s'].append(d['rsds'])
        if 'psl' in d: aggregator['historical'][m]['p'].append(d['psl'])
        if 'sfcWind' in d: aggregator['historical'][m]['w'].append(d['sfcWind'])

    # Process Future
    for d in data.get('future_socal_cloudmap_monthly', []):
        scen = d.get('scenario')
        if scen in aggregator:
            m = d['month']
            init_month(scen, m)
            aggregator[scen][m]['c'].append(d['clt'])
            aggregator[scen][m]['t'].append(d['tas'])
            aggregator[scen][m]['s'].append(d['rsds'])
            if 'psl' in d: aggregator[scen][m]['p'].append(d['psl'])
            if 'sfcWind' in d: aggregator[scen][m]['w'].append(d['sfcWind'])

    # 3. Compute Averages & Transform
    for scen in ['historical', 'ssp245', 'ssp585']:
        for m in range(1, 13):
            d = aggregator[scen].get(m)
            if d and d['c']:
                avg = lambda arr: sum(arr) / len(arr) if arr else 0
                
                climatology[scen][m] = {
                    'clt': avg(d['c']),
                    'temp': (avg(d['t']) - 273.15) * 9/5 + 32, # K -> F
                    'solar': avg(d['s']), # W/m2
                    'pressure': avg(d['p']) / 100, # Pa -> hPa
                    'wind': avg(d['w']) * 2.23694, # m/s -> mph
                    'cloudFraction': avg(d['c']) / 100 # Derived
                }
            else:
                 climatology[scen][m] = None # Or empty object

    # 4. Write Output
    with open('data/climate_lab_transformed.json', 'w') as f:
        json.dump(climatology, f, indent=2)
    
    print("Successfully generated data/climate_lab_transformed.json")

if __name__ == '__main__':
    process_data()
