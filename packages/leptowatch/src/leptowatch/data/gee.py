"""Google Earth Engine exports (Python API, run from Colab).

All exports go to Google Drive folder  LeptoWatch_ee  as CSV, one task per year or season, so a
failed task can be re-run alone. Download nothing by hand: notebook 04 copies the CSVs from
Drive into data/raw/ee automatically.

  rain    CHIRPS daily rainfall, mean per RDHS area, every day 2006-12-23 .. today
  soil    ERA5-Land daily soil moisture (0-7 cm), mean per RDHS area (no cropland mask: at 11 km
          the mask emptied 9 wet-zone districts in the first test)
  flood   LeptoWatch Flood Rule (LFR v1.0, frozen thresholds z <= -1.5 and VV <= -16 dB) on every
          Sentinel-1 date, flooded hectares of the cropland-based paddy proxy and of all land
  gfs     archived GFS rainfall forecasts issued on each Monday (stretch goal)
  pop     WorldPop population per RDHS area (for checks and the MOH ranking)

Usage in Colab:
    from leptowatch.data import gee
    gee.init('your-ee-project-id')
    gee.export_rain(2007, 2026); gee.export_soil(2007, 2026); gee.export_flood(2017, 2026)
    gee.task_status()
"""
from __future__ import annotations

import datetime as dt
import json

from leptowatch.config import load_config, path

try:
    import ee
except ImportError:  # pragma: no cover - only needed in Colab
    ee = None

FOLDER = 'LeptoWatch_ee'
_FC = None


def init(project: str | None = None):
    """Colab: authenticate in the browser once. GitHub Actions: a service-account key in
    GOOGLE_APPLICATION_CREDENTIALS. Project = your Cloud project ID (config earth_engine_project)."""
    import os
    project = project or load_config().get('earth_engine_project') or os.environ.get('LW_EE_PROJECT')
    key = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if key and os.path.exists(key):
        sa = json.load(open(key))['client_email']
        ee.Initialize(ee.ServiceAccountCredentials(sa, key), project=project)
    else:
        try:
            ee.Initialize(project=project)
        except Exception:  # noqa: BLE001
            ee.Authenticate()
            ee.Initialize(project=project)
    print('Earth Engine ready:', project)


def rdhs_fc():
    """The 26 RDHS polygons (built by boundaries.py) as an ee.FeatureCollection with property 'rdhs'."""
    global _FC
    if _FC is None:
        gj = json.loads(path('raw', 'boundaries', 'rdhs_26_simplified.geojson').read_text())
        feats = [ee.Feature(ee.Geometry(f['geometry']), {'rdhs': f['properties']['rdhs']}) for f in gj['features']]
        _FC = ee.FeatureCollection(feats)
    return _FC


def _start(task):
    task.start()
    print('  started', task.status()['description'])
    return task


def _export(fc, desc, selectors):
    return _start(ee.batch.Export.table.toDrive(collection=fc, description=desc, folder=FOLDER,
                                                fileFormat='CSV', selectors=selectors))


def _daily_table(col, band, scale, fc):
    def per_image(img):
        d = img.date().format('YYYY-MM-dd')
        return img.select(band).reduceRegions(collection=fc, reducer=ee.Reducer.mean(), scale=scale, tileScale=4) \
            .map(lambda f: f.setGeometry(None).set('date', d))
    return col.map(per_image).flatten()


def export_rain(first_year=2007, last_year=None):
    last_year = last_year or dt.date.today().year
    fc = rdhs_fc()
    col = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    for y in range(first_year, last_year + 1):
        s = f'{y - 1}-12-23' if y == first_year else f'{y}-01-01'
        t = _daily_table(col.filterDate(s, f'{y + 1}-01-01'), 'precipitation', 5566, fc)
        _export(t, f'lw_rain_{y}', ['rdhs', 'date', 'mean'])


def export_soil(first_year=2007, last_year=None):
    last_year = last_year or dt.date.today().year
    fc = rdhs_fc()
    col = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR')
    for y in range(first_year, last_year + 1):
        s = f'{y - 1}-12-23' if y == first_year else f'{y}-01-01'
        t = _daily_table(col.filterDate(s, f'{y + 1}-01-01'), 'volumetric_soil_water_layer_1', 11132, fc)
        _export(t, f'lw_soil_{y}', ['rdhs', 'date', 'mean'])


# ------------------------------------------------------------------ flood rule
def _static_masks(max_slope):
    wc = ee.ImageCollection('ESA/WorldCover/v200').first()
    perm = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').unmask(0).gt(
        load_config()['flood_rule']['permanent_water_occurrence'])
    flat = ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003')).lt(max_slope)
    paddy = wc.eq(40).And(perm.Not()).And(flat)
    land = wc.neq(50).And(wc.neq(80)).And(perm.Not()).And(flat)
    return paddy, land


def _s1(aoi, radius):
    def prep(img):
        vv = img.select('VV')
        vv = vv.updateMask(vv.gt(-30)).focal_median(radius, 'circle', 'meters').rename('VV')
        return ee.Image(vv.copyProperties(img, ['system:time_start', 'relativeOrbitNumber_start']))
    return (ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(aoi)
            .filter(ee.Filter.eq('instrumentMode', 'IW'))
            .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
            .map(prep))


def seasons(first_year, last_year):
    """Maha y = Oct y - Mar y+1; Yala Y = Apr - Sep Y. Reference = the 4 dry windows before the season."""
    out = []
    for y in range(first_year, last_year + 1):
        if y < last_year or dt.date.today() >= dt.date(y, 10, 1):
            out.append(dict(name=f'Maha {y}/{str(y + 1)[2:]}', start=f'{y}-10-01', end=f'{y + 1}-04-01',
                            refs=[(y - 1, 2), (y - 1, 8), (y, 2), (y, 8)]))
        if y > first_year:
            out.append(dict(name=f'Yala {y}', start=f'{y}-04-01', end=f'{y}-10-01',
                            refs=[(y - 2, 8), (y - 1, 2), (y - 1, 8), (y, 2)]))
    return out


def flood_season_table(season, fc=None):
    """Flooded hectares per RDHS area for every radar date of one season (frozen thresholds)."""
    fr = load_config()['flood_rule']
    fc = fc or rdhs_fc()
    paddy, land = _static_masks(fr['max_slope_deg'])
    s1 = _s1(fc.geometry().bounds(), fr['speckle_radius_m'])
    ref = None
    for (yy, mm) in season['refs']:
        a = ee.Date.fromYMD(yy, mm, 1)
        part = s1.filterDate(a, a.advance(2, 'month'))
        ref = part if ref is None else ref.merge(part)
    orbits = ref.aggregate_array('relativeOrbitNumber_start').distinct()
    wet = s1.filterDate(season['start'], season['end']).filter(
        ee.Filter.inList('relativeOrbitNumber_start', orbits))

    def flood(img):
        r = ref.filter(ee.Filter.eq('relativeOrbitNumber_start', img.get('relativeOrbitNumber_start')))
        mu = r.mean()
        sd = r.reduce(ee.Reducer.stdDev()).max(fr['sd_floor'])
        observed = r.count().gte(fr['min_ref_obs'])
        z = img.subtract(mu).divide(sd)
        f = z.lte(fr['z_threshold']).And(img.lte(fr['vv_threshold_db'])).rename('flood')
        return ee.Image(f.updateMask(observed).copyProperties(img, ['system:time_start']))

    fl = wet.map(flood)
    dates = ee.List(fl.aggregate_array('system:time_start')).map(
        lambda t: ee.Date(t).format('YYYY-MM-dd')).distinct()

    def per_date(d):
        d0 = ee.Date(d)
        day = fl.filterDate(d0, d0.advance(1, 'day'))
        f = day.max()
        obs = f.mask().reduce(ee.Reducer.max())
        fu = f.unmask(0)
        stack = ee.Image.cat([paddy.And(obs).rename('paddy_obs_ha'), land.And(obs).rename('land_obs_ha'),
                              fu.And(paddy).rename('paddy_flood_ha'), fu.And(land).rename('land_flood_ha')])
        stack = stack.multiply(ee.Image.pixelArea()).divide(1e4)
        return stack.reduceRegions(collection=fc, reducer=ee.Reducer.sum(), scale=30, tileScale=8) \
            .map(lambda ft: ft.setGeometry(None).set({'date': d, 'season': season['name'],
                                                      'n_scenes': day.size(), 'n_ref_passes': ref.size(),
                                                      'rule': fr['version']}))
    return ee.FeatureCollection(dates.map(per_date)).flatten()


def export_flood(first_year=2017, last_year=None, only=None):
    """One task per season. `only` = list of season names to (re)run, e.g. ['Maha 2023/24']."""
    last_year = last_year or dt.date.today().year
    cols = ['rdhs', 'date', 'season', 'n_scenes', 'n_ref_passes', 'rule',
            'paddy_obs_ha', 'land_obs_ha', 'paddy_flood_ha', 'land_flood_ha']
    for se in seasons(first_year, last_year):
        if only and se['name'] not in only:
            continue
        tag = se['name'].replace(' ', '_').replace('/', '_')
        _export(flood_season_table(se), f'lw_flood_{tag}', cols)


# ------------------------------------------------------------------ stretch: archived GFS forecasts
def export_gfs(first_year=2016, last_year=None, horizons=(24, 48, 72, 96, 120, 144, 168)):
    """Forecast rainfall issued at 00 UTC each Monday; one task per year.
    Post-processing (env.py) checks whether the band is accumulated and derives 7-day totals."""
    last_year = last_year or dt.date.today().year
    fc = rdhs_fc()
    gfs = ee.ImageCollection('NOAA/GFS0P25').select('total_precipitation_surface')
    for y in range(first_year, last_year + 1):
        d = dt.date(y, 1, 1)
        d += dt.timedelta(days=(7 - d.weekday()) % 7)
        mondays = []
        while d.year == y and d <= dt.date.today():
            mondays.append(d.isoformat())
            d += dt.timedelta(days=7)

        def per_issue(ds):
            t0 = ee.Date(ds).millis()
            run = gfs.filter(ee.Filter.eq('creation_time', t0)).filter(
                ee.Filter.inList('forecast_hours', list(horizons)))

            def per_h(img):
                return img.reduceRegions(collection=fc, reducer=ee.Reducer.mean(), scale=27830) \
                    .map(lambda f: f.setGeometry(None).set({'issue_date': ds, 'h': img.get('forecast_hours')}))
            return run.map(per_h).flatten()
        t = ee.FeatureCollection(ee.List(mondays).map(per_issue)).flatten()
        _export(t, f'lw_gfs_{y}', ['rdhs', 'issue_date', 'h', 'mean'])


def export_population(year=2020):
    fc = rdhs_fc()
    pop = ee.ImageCollection('WorldPop/GP/100m/pop').filter(ee.Filter.eq('country', 'LKA')) \
        .filter(ee.Filter.eq('year', year)).first()
    t = pop.reduceRegions(collection=fc, reducer=ee.Reducer.sum(), scale=100, tileScale=4) \
        .map(lambda f: f.setGeometry(None).set('year', year))
    _export(t, f'lw_population_{year}', ['rdhs', 'year', 'sum'])


# ------------------------------------------------------------------ live (small, interactive)
def recent_daily(kind, days=70):
    """Last `days` of rain or soil per RDHS area, returned directly (no Drive export). For the weekly run."""
    import pandas as pd
    end = dt.date.today()
    start = end - dt.timedelta(days=days)
    if kind == 'rain':
        col, band, scale = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY'), 'precipitation', 5566
    else:
        col, band, scale = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR'), 'volumetric_soil_water_layer_1', 11132
    t = _daily_table(col.filterDate(str(start), str(end)), band, scale, rdhs_fc())
    rows = t.getInfo()['features']
    return pd.DataFrame([r['properties'] for r in rows]).rename(columns={'mean': 'value'})


def recent_flood(days=40):
    """Flood rule on radar passes of the last `days`, using the current season's reference."""
    import pandas as pd
    today = dt.date.today()
    se = [s for s in seasons(today.year - 1, today.year) if s['start'] <= str(today) < s['end']][-1]
    se = dict(se, start=str(today - dt.timedelta(days=days)))
    rows = flood_season_table(se).getInfo()['features']
    return pd.DataFrame([r['properties'] for r in rows])


def task_status(n=40):
    for t in ee.batch.Task.list()[:n]:
        s = t.status()
        print(f"{s['description']:<28} {s['state']:<10} {s.get('error_message', '')}")
