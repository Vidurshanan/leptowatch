"""Penalised negative-binomial regression (NB2, log link) with distributed-lag spline bases.

Written from scratch with numpy/scipy so it runs anywhere and every step is visible:
  * NB2 log-likelihood with analytic gradients, fitted by L-BFGS;
  * ridge penalty on all coefficients except the intercept -> district effects are shrunk
    towards the national mean (the "partial pooling" of the proposal);
  * distributed lags: a lagged exposure (e.g. 12 weekly rainfall lags) enters through a
    small spline basis over the lag axis (a DLNM-style cross-basis, Gasparrini 2010), so the
    model learns a smooth lag curve with 4 numbers instead of 12.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import digamma, gammaln


def lag_basis(n_lags: int, df: int) -> np.ndarray:
    """B-spline basis over lag index 0..n_lags-1, shape (n_lags, df)."""
    from sklearn.preprocessing import SplineTransformer
    x = np.arange(n_lags, dtype=float).reshape(-1, 1)
    st = SplineTransformer(n_knots=max(df - 1, 2), degree=min(3, df - 1) if df > 1 else 1, include_bias=True)
    B = st.fit_transform(x)
    return B[:, :df] if B.shape[1] >= df else B


class NBGLM:
    """y ~ NB2(mu, alpha), log(mu) = b0 + X b. Penalty 0.5 * ridge * ||b||^2 (b0 not penalised)."""

    def __init__(self, ridge=1.0, max_iter=500):
        self.ridge, self.max_iter = ridge, max_iter

    def _nll(self, params, X, y):
        b, la = params[:-1], params[-1]
        r = np.exp(-la)
        eta = np.clip(X @ b, -20, 20)
        mu = np.exp(eta)
        ll = gammaln(y + r) - gammaln(r) - gammaln(y + 1) + r * np.log(r / (r + mu)) + y * np.log(mu / (r + mu) + 1e-300)
        pen = 0.5 * self.ridge * np.sum(b[1:] ** 2)
        dl_deta = (y - mu) * r / (r + mu)
        g_b = -(X.T @ dl_deta)
        g_b[1:] += self.ridge * b[1:]
        dl_dr = digamma(y + r) - digamma(r) + np.log(r / (r + mu)) + 1 - (r + y) / (r + mu)
        g_la = np.sum(r * dl_dr)          # d(-ll)/d log(alpha) = sum r * dl/dr
        return -ll.sum() + pen, np.append(g_b, g_la)

    def fit(self, X: np.ndarray, y: np.ndarray):
        X1 = np.column_stack([np.ones(len(X)), X])
        b0 = np.zeros(X1.shape[1])
        b0[0] = np.log(max(y.mean(), 0.1))
        x0 = np.append(b0, np.log(0.5))
        bounds = [(None, None)] * X1.shape[1] + [(-8, 4)]
        res = minimize(self._nll, x0, args=(X1, y), jac=True, method='L-BFGS-B', bounds=bounds,
                       options={'maxiter': self.max_iter})
        self.coef_, self.alpha_ = res.x[:-1], float(np.exp(res.x[-1]))
        self.converged_ = bool(res.success)
        self.train_deviance_ = self.deviance(X, y)
        return self

    def predict_mu(self, X):
        return np.exp(np.clip(np.column_stack([np.ones(len(X)), X]) @ self.coef_, -20, 20))

    def deviance(self, X, y):
        """Mean NB deviance (lower is better)."""
        mu = self.predict_mu(X)
        r = 1 / self.alpha_
        with np.errstate(all='ignore'):
            t1 = np.where(y > 0, y * np.log(y / mu), 0.0)
            t2 = (y + r) * np.log((y + r) / (mu + r))
        return float(np.mean(2 * (t1 - t2)))


class Design:
    """Turns a feature table into the GLM design matrix (standardise, impute, cross-bases, dummies)."""

    def __init__(self, linear, lag_groups, n_lag_df=4, district=True, log_cols=()):
        self.linear, self.lag_groups, self.n_lag_df = list(linear), dict(lag_groups), n_lag_df
        self.district, self.log_cols = district, set(log_cols)

    def _lin(self, df):
        X = df[self.linear].astype(float).copy()
        for c in self.log_cols & set(X.columns):
            X[c] = np.log1p(X[c].clip(lower=0))
        return X

    def fit(self, df):
        X = self._lin(df)
        self.mean_, self.sd_ = X.mean(), X.std().replace(0, 1).fillna(1)
        self.bases_, self.lag_mean_ = {}, {}
        for g, cols in self.lag_groups.items():
            self.bases_[g] = lag_basis(len(cols), min(self.n_lag_df, len(cols)))
            self.lag_mean_[g] = df[cols].astype(float).mean()
        if self.district:
            self.levels_ = sorted(df.rdhs.unique())
        Z = self.transform(df, fitting=True)
        self.cb_mean_, self.cb_sd_ = Z.mean(0), Z.std(0)
        self.cb_sd_[self.cb_sd_ == 0] = 1
        return self

    def transform(self, df, fitting=False):
        X = ((self._lin(df) - self.mean_) / self.sd_).fillna(0.0).values
        parts = [X]
        self.names_ = list(self.linear)
        for g, cols in self.lag_groups.items():
            L = df[cols].astype(float).fillna(self.lag_mean_[g]).fillna(0.0).values
            cb = L @ self.bases_[g]
            parts.append(cb)
            self.names_ += [f'{g}_cb{j}' for j in range(cb.shape[1])]
        if self.district:
            D = (df.rdhs.to_numpy(dtype=object)[:, None] == np.array(self.levels_, dtype=object)[None, :]).astype(float)
            parts.append(D)
            self.names_ += [f'rdhs={l}' for l in self.levels_]
        Z = np.column_stack(parts)
        if not fitting:
            Z = (Z - self.cb_mean_) / self.cb_sd_
        return Z

    def matrix(self, df):
        return self.transform(df)

    def groups(self):
        """Map each design column to a readable group name (for explanations)."""
        out = []
        for n in self.names_:
            if '_cb' in n:
                out.append(n.split('_cb')[0])
            elif n.startswith('rdhs='):
                out.append('district')
            else:
                out.append(n)
        return out
