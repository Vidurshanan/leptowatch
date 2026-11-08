"""Build the 26 RDHS polygons (run in Colab; needs geopandas).

  * 24 RDHS areas = their administrative district (official NSDI District Boundary layer).
  * Ampara district holds two RDHS areas. The PROVISIONAL Kalmunai boundary is the union of the
    Divisional Secretariat (DS) divisions listed in config/kalmunai_ds_divisions.csv, clipped to
    the district; Ampara RDHS is the rest of the district. It stays labelled provisional.
  * Case counts are never moved between Ampara and Kalmunai; this file only affects
    satellite and weather values.

Source: Survey Department of Sri Lanka, NSDI Boundary map service
  https://gisapps.nsdi.gov.lk/server/rest/services/SLNSDI/Boundary/MapServer
  layer 5 = District Boundary, layer 4 = Divisional Secretariat Boundary.
Fallback: put the HDX COD-AB shapefiles (adm2 = districts, adm3 = DS divisions) in raw/boundaries
and call build(source='hdx').

Run:  python -m leptowatch.data.boundaries
Out:  raw/boundaries/rdhs_26.geojson, rdhs_26_simplified.geojson, rdhs_adjacency.csv,
      ds_divisions.geojson, boundary_checks.json
"""
from __future__ import annotations

import difflib
import json
import re
import sys

import pandas as pd

from leptowatch.config import CONFIG_DIR, path, rdhs_table

NSDI = 'https://gisapps.nsdi.gov.lk/server/rest/services/SLNSDI/Boundary/MapServer'


def _fetch_layer(layer: int):
    """Download a whole ArcGIS REST layer as a GeoDataFrame (pages of 1000 features)."""
    import geopandas as gpd
    import requests
    frames, offset = [], 0
    while True:
        r = requests.get(f'{NSDI}/{layer}/query', params={
            'where': '1=1', 'outFields': '*', 'returnGeometry': 'true', 'outSR': 4326, 'f': 'geojson',
            'resultOffset': offset, 'resultRecordCount': 1000}, timeout=120)
        r.raise_for_status()
        gj = r.json()
        feats = gj.get('features', [])
        if not feats:
            break
        frames.append(gpd.GeoDataFrame.from_features(feats, crs=4326))
        if len(feats) < 1000:
            break
        offset += 1000
    return pd.concat(frames, ignore_index=True)


def _union(gs):
    return gs.union_all() if hasattr(gs, 'union_all') else gs.unary_union


def _name_col(gdf, hints):
    cols = [c for c in gdf.columns if gdf[c].dtype == object and c != 'geometry']
    for h in hints:
        for c in cols:
            if h in c.lower():
                return c
    raise KeyError(f'no name column among {cols}')


def _norm(s):
    s = str(s).lower().replace('&', 'and')
    s = re.sub(r'\b(ds|division|divisional|secretariat|district|pradeshiya)\b', '', s)
    return re.sub(r'[^a-z]', '', s)


def _match(name, choices):
    m = difflib.get_close_matches(_norm(name), [_norm(c) for c in choices], n=1, cutoff=0.72)
    if not m:
        return None
    return [c for c in choices if _norm(c) == m[0]][0]


def build(source='nsdi'):
    import geopandas as gpd
    if source == 'nsdi':
        dist, ds = _fetch_layer(5), _fetch_layer(4)
    else:
        bdir = path('raw', 'boundaries', 'x').parent
        dist = gpd.read_file(next(bdir.glob('*adm2*.shp')))
        ds = gpd.read_file(next(bdir.glob('*adm3*.shp')))
    dist = dist.to_crs(4326)
    ds = ds.to_crs(4326)
    dcol = _name_col(dist, ['district', 'adm2_en', 'dis', 'name'])
    scol = _name_col(ds, ['dsd', 'ds_', 'adm3_en', 'division', 'name'])
    print('district name column:', dcol, '| DS name column:', scol)

    rt = rdhs_table()
    out = []
    for _, r in rt.iterrows():
        if r.rdhs in ('Ampara', 'Kalmunai'):
            continue
        hit = _match(r.district, dist[dcol].tolist())
        if hit is None:
            raise ValueError(f'district not found: {r.district}')
        out.append({'rdhs': r.rdhs, 'district': r.district, 'provisional': False,
                    'geometry': dist.loc[dist[dcol] == hit].geometry.pipe(_union)})

    amp = dist.loc[dist[dcol] == _match('Ampara', dist[dcol].tolist())].geometry.pipe(_union)
    ds_in = ds[ds.geometry.representative_point().within(amp)].copy()
    plan = pd.read_csv(CONFIG_DIR / 'kalmunai_ds_divisions.csv')
    ds_in['matched'] = ds_in[scol].map(lambda n: _match(n, plan.ds_division.tolist()))
    unmatched = ds_in[ds_in.matched.isna()][scol].tolist()
    kal_names = set(plan.loc[plan.rdhs == 'Kalmunai', 'ds_division'])
    kal = ds_in[ds_in.matched.isin(kal_names)].geometry.pipe(_union).intersection(amp)
    ampara_rest = amp.difference(kal)
    out += [{'rdhs': 'Ampara', 'district': 'Ampara', 'provisional': True, 'geometry': ampara_rest},
            {'rdhs': 'Kalmunai', 'district': 'Ampara', 'provisional': True, 'geometry': kal}]
    g = gpd.GeoDataFrame(out, crs=4326)

    # ---- checks
    m = g.to_crs(5235)  # SLD99 / Sri Lanka Grid 1999 (metres)
    a_amp, a_kal = m.loc[m.rdhs == 'Ampara'].area.sum(), m.loc[m.rdhs == 'Kalmunai'].area.sum()
    a_dist = gpd.GeoSeries([amp], crs=4326).to_crs(5235).area.sum()
    checks = {
        'n_areas': int(len(g)),
        'ampara_district_km2': round(a_dist / 1e6, 1),
        'kalmunai_km2': round(a_kal / 1e6, 1), 'ampara_rdhs_km2': round(a_amp / 1e6, 1),
        'gap_or_overlap_pct': round(100 * abs(a_amp + a_kal - a_dist) / a_dist, 3),
        'kalmunai_area_share_pct': round(100 * a_kal / a_dist, 1),
        'ds_in_ampara': ds_in[scol].tolist(), 'ds_unmatched': unmatched,
        'kalmunai_ds_found': sorted(ds_in.loc[ds_in.matched.isin(kal_names), scol].tolist()),
        'status': 'PROVISIONAL - verify the DS list against the Kalmunai RDHS MOH areas',
    }
    print(json.dumps(checks, indent=1))
    if unmatched:
        print('WARNING: DS divisions not in config/kalmunai_ds_divisions.csv:', unmatched)

    # ---- adjacency (areas sharing a border; small buffer absorbs slivers)
    gb = m.copy()
    gb['geometry'] = gb.buffer(200)
    adj = [(a.rdhs, b.rdhs) for i, a in gb.iterrows() for j, b in gb.iterrows()
           if i < j and a.geometry.intersects(b.geometry)]
    pd.DataFrame(adj, columns=['a', 'b']).to_csv(path('raw', 'boundaries', 'rdhs_adjacency.csv'), index=False)

    g.to_file(path('raw', 'boundaries', 'rdhs_26.geojson'), driver='GeoJSON')
    gs = g.copy()
    gs['geometry'] = gs.to_crs(5235).simplify(150).to_crs(4326)
    gs.to_file(path('raw', 'boundaries', 'rdhs_26_simplified.geojson'), driver='GeoJSON')
    ds_in[[scol, 'matched', 'geometry']].rename(columns={scol: 'ds_division'}).to_file(
        path('raw', 'boundaries', 'ampara_ds_divisions.geojson'), driver='GeoJSON')
    path('raw', 'boundaries', 'boundary_checks.json').write_text(json.dumps(checks, indent=1))
    return g, checks


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else 'nsdi')
