"""The baselines and the four detectors (proposal Section 6).

  B0  same three weeks last year
  B1  average of the same three weeks in all earlier years
  B2  rainfall-only negative binomial with distributed lags (mirrors the published Sri Lankan models)
  A   pooled negative binomial with spline distributed lags of rainfall, soil moisture, flooding,
      case history, seasonality and district effects shrunk to the national mean
  B   LightGBM: count head (Poisson), quantile heads, and two surge classifiers (Elevated, High)
  C   rule layer: EARS C1/C2/C3 + a Farrington-style limit on the latest published week
  D   post-flood trigger: paddy wetness well above its usual level during cultivation weeks

All share: fit(train_df) -> self ; predict(df) -> frame (see models/common.py).
C and D return flags, not distributions.
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

from leptowatch.config import load_config
from leptowatch.models.common import nb_dispersion, nb_frame, qcol, quantile_levels, sort_quantiles
from leptowatch.models.glm_nb import Design, NBGLM

TARGET = 'y35'


def _train_rows(df, target=TARGET):
    return df[df[target].notna()]


# --------------------------------------------------------------------------- baselines
class B0:
    name = 'B0'

    def fit(self, tr):
        tr = _train_rows(tr)
        m = tr.b0_same_window_last_year.notna()
        self.alpha_ = nb_dispersion(tr.loc[m, TARGET], tr.loc[m, 'b0_same_window_last_year'].clip(lower=0.5))
        return self

    def predict(self, df):
        mu = df.b0_same_window_last_year.fillna(df.b1_clim_mean).fillna(df.scale_3y).fillna(1.0).clip(lower=0.5)
        return nb_frame(mu, self.alpha_, df.thrE35, df.thrH35, df.index)


class B1(B0):
    name = 'B1'

    def fit(self, tr):
        tr = _train_rows(tr)
        m = tr.b1_clim_mean.notna()
        self.alpha_ = nb_dispersion(tr.loc[m, TARGET], tr.loc[m, 'b1_clim_mean'].clip(lower=0.5))
        return self

    def predict(self, df):
        mu = df.b1_clim_mean.fillna(df.scale_3y).fillna(1.0).clip(lower=0.5)
        return nb_frame(mu, self.alpha_, df.thrE35, df.thrH35, df.index)


# --------------------------------------------------------------------------- NB family (B2 and A)
class NBDetector:
    """Configurable pooled NB model. B2 and detector A are two settings of this class."""

    def __init__(self, name='A', use_cases=True, use_rain=True, use_soil=True, use_flood=True,
                 use_fcst=True, use_river=True, ridge=None, lag_df=None, train_from=None):
        cfg = load_config()['models']['nb']
        self.name = name
        self.use = dict(cases=use_cases, rain=use_rain, soil=use_soil, flood=use_flood, fcst=use_fcst, river=use_river)
        self.ridge = cfg['ridge'] if ridge is None else ridge
        self.lag_df = cfg['lag_df'] if lag_df is None else lag_df
        self.train_from = train_from

    def _spec(self, df):
        lin, lags, logc = ['sin1', 'cos1', 'sin2', 'cos2', 'scale_3y'], {}, ['scale_3y']
        if self.use['cases']:
            c = ['c_last1', 'c_last4', 'c_last8', 'b0_same_window_last_year', 'b1_clim_mean', 'nowcast_last3']
            lin += c + ['c_trend4', 'c_ratio_vs_last_year']
            logc += c
            if 'nb_c_ratio_vs_last_year' in df:
                lin.append('nb_c_ratio_vs_last_year')
        if self.use['rain']:
            lags['rain'] = [f'rain_l{k}' for k in range(12)]
            lin += ['rain_4w_anom', 'rain_12w_anom']
        if self.use['soil']:
            lags['soil'] = [f'soil_l{k}' for k in range(8)]
            lin += ['soil_4w_anom']
        if self.use['flood']:
            lags['pflood'] = [f'pflood_l{k}' for k in range(8)]
            lin += ['pflood_max4w_ratio', 'lflood_max4w_ratio', 'flood_available']
            if 'nb_pflood_max4w_ratio' in df:
                lin.append('nb_pflood_max4w_ratio')
        if self.use['fcst']:
            lin += ['rain_fcst_7d']
            logc.append('rain_fcst_7d')
        if self.use['river']:
            lin += ['river_max4w_anom']
        # drop inputs that are entirely missing in the training data (e.g. no river export yet)
        lin = [c for c in lin if c in df and df[c].notna().any()]
        lags = {g: cols for g, cols in lags.items() if all(c in df for c in cols) and df[cols].notna().any().any()}
        for c in ('pflood_max4w_ratio', 'lflood_max4w_ratio', 'nb_pflood_max4w_ratio'):
            if c in lin:
                logc.append(c)
        return lin, lags, logc

    def fit(self, tr):
        tr = _train_rows(tr)
        if self.train_from is not None:
            tr = tr[tr.issue_start >= pd.Timestamp(self.train_from)]
        lin, lags, logc = self._spec(tr)
        self.design_ = Design(lin, lags, self.lag_df, district=True, log_cols=logc).fit(tr)
        X = self.design_.matrix(tr)
        self.glm_ = NBGLM(ridge=self.ridge).fit(X, tr[TARGET].values.astype(float))
        self.n_train_ = len(tr)
        return self

    def predict(self, df):
        mu = self.glm_.predict_mu(self.design_.matrix(df))
        return nb_frame(mu, self.glm_.alpha_, df.thrE35, df.thrH35, df.index)

    def contributions(self, df):
        """Per-row contribution of each input group to log(mu) (for plain-language reasons)."""
        X = self.design_.matrix(df)
        contrib = X * self.glm_.coef_[1:]
        groups = self.design_.groups()
        out = pd.DataFrame(contrib, columns=groups, index=df.index)
        return out.T.groupby(level=0).sum().T


def B2():
    return NBDetector('B2', use_cases=False, use_rain=True, use_soil=False, use_flood=False, use_fcst=False,
                      use_river=False)


def DetectorA(**kw):
    return NBDetector('A', **kw)


# --------------------------------------------------------------------------- detector B (LightGBM)
try:
    import lightgbm as lgb
except ImportError:  # pragma: no cover
    lgb = None

EXCLUDE = {'t', 'rdhs', 'issue_start', 'year', 'week', 'y35', 'y12', 'surgeE', 'surgeH', 'surgeE12',
           'thrE12', 'thrH12'}


class DetectorB:
    """LightGBM heads. Early stopping on the last year of the training window, then refit on all."""
    name = 'B'

    def __init__(self, params=None, groups=None, heads=('count', 'quantile', 'clf'), drop=()):
        cfg = load_config()['models']
        self.params = dict(cfg['lgbm'])
        if params:
            self.params.update(params)
        self.seed = cfg['random_seed']
        self.heads, self.drop, self.groups = heads, set(drop), groups
        self.qs = quantile_levels()
        self.q_heads = cfg.get('lgbm_quantile_heads', self.qs)

    def features(self, df):
        cols = [c for c in df.columns if c not in EXCLUDE and c not in self.drop and df[c].dtype != object
                and not np.issubdtype(df[c].dtype, np.datetime64)]
        if self.groups is not None:
            cols = [c for c in cols if c in self.groups or c == 'rdhs_code']
        return cols

    def _lgb_params(self, objective, **extra):
        p = {k: v for k, v in self.params.items() if k not in ('n_estimators', 'early_stopping_rounds')}
        p.update(objective=objective, verbosity=-1, seed=self.seed, deterministic=True, num_threads=0)
        p.update(extra)
        return p

    def _fit_one(self, Xtr, ytr, Xva, yva, objective, **extra):
        p = self._lgb_params(objective, **extra)
        dtr = lgb.Dataset(Xtr, ytr, categorical_feature=['rdhs_code'], free_raw_data=False)
        evals = {}
        if Xva is not None and len(Xva) > 50 and len(np.unique(yva)) > 1:
            dva = lgb.Dataset(Xva, yva, reference=dtr)
            m = lgb.train(p, dtr, num_boost_round=self.params['n_estimators'], valid_sets=[dtr, dva],
                          valid_names=['train', 'valid'],
                          callbacks=[lgb.early_stopping(self.params['early_stopping_rounds'], verbose=False),
                                     lgb.record_evaluation(evals)])
            best = max(m.best_iteration, 20)
        else:
            best = 300
        Xall = pd.concat([Xtr, Xva]) if Xva is not None else Xtr
        yall = np.concatenate([ytr, yva]) if Xva is not None else ytr
        final = lgb.train(p, lgb.Dataset(Xall, yall, categorical_feature=['rdhs_code']), num_boost_round=best)
        return final, best, evals

    def fit(self, tr):
        if lgb is None:
            raise ImportError('pip install lightgbm')
        tr = _train_rows(tr)
        self.cols_ = self.features(tr)
        cut = tr.t.max() - 52 - 5                   # inner validation = last year, with a 5-week gap
        a, b = tr[tr.t <= cut], tr[tr.t > cut + 5]
        Xa, Xb = a[self.cols_], b[self.cols_]
        self.models_, self.best_iter_, self.curves_ = {}, {}, {}
        if 'count' in self.heads:
            m, it, ev = self._fit_one(Xa, a[TARGET].values, Xb, b[TARGET].values, 'poisson')
            self.models_['count'], self.best_iter_['count'], self.curves_['count'] = m, it, ev
            self.alpha_ = nb_dispersion(tr[TARGET], np.clip(m.predict(tr[self.cols_]), 0.1, None))
        if 'quantile' in self.heads:
            for q in self.q_heads:
                m, it, _ = self._fit_one(Xa, a[TARGET].values, Xb, b[TARGET].values, 'quantile', alpha=q)
                self.models_[qcol(q)], self.best_iter_[qcol(q)] = m, it
        if 'clf' in self.heads:
            for lab in ('surgeE', 'surgeH'):
                aa, bb = a[a[lab].notna()], b[b[lab].notna()]
                if aa[lab].nunique() < 2:
                    continue
                m, it, ev = self._fit_one(aa[self.cols_], aa[lab].values, bb[self.cols_], bb[lab].values, 'binary')
                self.models_[lab], self.best_iter_[lab], self.curves_[lab] = m, it, ev
        return self

    def predict(self, df):
        X = df[self.cols_]
        out = pd.DataFrame(index=df.index)
        mu = np.clip(self.models_['count'].predict(X), 0.05, None)
        out['mu'] = mu
        base = nb_frame(mu, self.alpha_, df.thrE35, df.thrH35, df.index)
        for q in self.qs:
            c = qcol(q)
            out[c] = np.clip(self.models_[c].predict(X), 0, None) if c in self.models_ else base[c]
        for lab, col in (('surgeE', 'pE'), ('surgeH', 'pH')):
            out[col] = self.models_[lab].predict(X) if lab in self.models_ else base[col]
            out.loc[df['thrE35' if col == 'pE' else 'thrH35'].isna(), col] = np.nan
        return sort_quantiles(out)

    def shap(self, df, head='surgeE'):
        """Exact TreeSHAP contributions from LightGBM (no extra library needed)."""
        m = self.models_.get(head) or self.models_['count']
        c = m.predict(df[self.cols_], pred_contrib=True)
        return pd.DataFrame(c[:, :-1], columns=self.cols_, index=df.index)


# --------------------------------------------------------------------------- detector C (rule layer)
class DetectorC:
    """EARS C1/C2/C3 (Hutwagner 2003) and a Farrington-style limit on the latest published week."""
    name = 'C'

    def __init__(self, threshold=3.0, min_count=3):
        self.threshold, self.min_count = threshold, min_count

    def fit(self, tr):
        return self

    @staticmethod
    def _ears(df, start, n=7):
        base = df[[f'c_l{k}' for k in range(start, start + n)]].astype(float)
        m, s = base.mean(1), base.std(1).clip(lower=0.5)
        return m, s

    def predict(self, df):
        out = pd.DataFrame(index=df.index)
        x0 = df.c_l0.astype(float)
        m1, s1 = self._ears(df, 1)
        m2, s2 = self._ears(df, 3) if 'c_l9' in df else (m1, s1)
        out['C1'] = (x0 - m1) / s1
        out['C2'] = (x0 - m2) / s2
        c2_lag = [((df[f'c_l{k}'] - m2) / s2).clip(lower=0) for k in (0, 1, 2)]
        out['C3'] = sum(np.maximum(v - 1, 0) for v in c2_lag)
        enough = x0 >= self.min_count
        out['ears'] = (enough & ((out.C2 > self.threshold) | (out.C3 > 2 * self.threshold))).astype(int)
        out['farrington'] = (enough & (x0 > df.farr_upper)).astype(int)
        out['fire'] = ((out.ears == 1) | (out.farrington == 1)).astype(int)
        return out


# --------------------------------------------------------------------------- detector D (post-flood trigger)
class DetectorD:
    """Fires in cultivation weeks when the paddy wetness signal is far above its usual level."""
    name = 'D'

    def __init__(self, ratio=None, min_frac=0.01):
        self.ratio = ratio if ratio is not None else load_config()['alerts']['post_flood_ratio']
        self.min_frac = min_frac

    def fit(self, tr):
        return self

    def predict(self, df):
        out = pd.DataFrame(index=df.index)
        r = df.pflood_max2w_ratio.astype(float)
        frac = df.pflood_max2w.astype(float)
        out['ratio'] = r
        out['fire'] = ((df.cultivation_window == 1) & (r >= self.ratio) & (frac >= self.min_frac)).fillna(False).astype(int)
        return out


def make(name, **kw):
    return {'B0': B0, 'B1': B1, 'B2': B2, 'A': DetectorA, 'B': DetectorB}[name](**kw) if kw else \
        {'B0': B0, 'B1': B1, 'B2': B2, 'A': DetectorA, 'B': DetectorB}[name]()


warnings.filterwarnings('ignore', category=UserWarning, module='lightgbm')
