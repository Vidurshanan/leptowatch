# LeptoWatch Model Status and Reliability Scorecard

## 1. Operational Mode and Approval Status

The LeptoWatch models and alert decision logic operate in:

```
EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED
```

- **Approval Flag:** `operational_approval = FALSE`
- **Decoupling from Freshness:** Data freshness (whether case reporting lag is within 56 days or exceeds it) is an internal latency metric and **does not** confer operational approval. A fresh dataset does not make an experimental model operational.
- **Regulatory Gate:** Live public-health action or clinical alert dispatch requires formal validation and authorization from the Ministry of Health Epidemiology Unit.

---

## 2. Evaluation Scope & Locked-Test Boundary

- **Evaluation Window:** 2011-12-31 to 2024-12-21 ($t = 261$ to $938$).
- **Sample Size:** 13,329 out-of-fold weekly health-area observations across 26 RDHS areas.
- **Locked-Test Partition:** `2025-01-01` onwards.
- **Evaluation Status of Locked Test:** **NOT_EVALUATED**.
  - In strict compliance with pre-registered research protocols, zero data points from 2025-01-01 onwards have been evaluated, accessed, or tuned against.

---

## 3. Pre-2025 Model Architecture Scorecard

| Model Code | Name | Family | Inputs | MAE | RMSE | $R^2$ Status | Rank |
|---|---|---|---|---:|---:|---|:---:|
| **B0** | Historical Mean Baseline | Empirical Baseline | Same calendar week historical mean | 9.42 | 18.21 | Not reported | 6 |
| **B1** | Autoregressive Case GLM | Negative Binomial GLM | Case autoregression (`nowcast_last3`, `c_trend4`) | 7.81 | 15.64 | Not reported | 5 |
| **B2** | Environmental Covariate GLM | Negative Binomial GLM | Case autoregression + CHIRPS rainfall + ERA5 soil moisture + Sentinel-1 SAR | 7.31 | 14.88 | Not reported | 4 |
| **A** | Outbreak Detector A | Threshold Classifier | Empirical historical quantiles ($q_{0.80}, q_{0.95}$) | 7.78 | 15.12 | Not reported | 3 |
| **B** | Outbreak Detector B | Logistic / Gradient Boosted | Autoregressive features + rainfall intensity + flood ratio | 7.04 | 14.10 | Not reported | 2 |
| **Blend** | Staging Ensemble Blend | Dynamic Weighted Ensemble | B0 + B1 + B2 + Detector A + Detector B | **6.92** | **13.75** | Not reported | **1** |

> [!NOTE]
> **$R^2$ Provenance Note**:
> Across the historical staging evaluation reports, $R^2$ was not adopted as the primary optimization objective due to extreme right-skewness and zero-inflation in weekly leptospirosis case counts. Consequently, $R^2$ is preserved strictly as `null` in API responses and reported as `"Not reported in source scorecard"` in user interfaces.

---

## 4. Probability Calibration Summary

Evaluation of outbreak probability forecasts for Elevated ($p_E$) and High ($p_H$) surge thresholds across 13,329 pre-2025 evaluation rows:

| Surge Target | Events ($n$) | Base Rate | Mean Predicted | Calibration-in-the-Large | Brier Score | ROC-AUC |
|---|---:|---:|---:|---:|---:|---:|
| **Elevated ($p_E \ge \text{thr}_{E35}$)** | 2,145 | 16.09% | 15.82% | -0.0027 | 0.0894 | 0.884 |
| **High ($p_H \ge \text{thr}_{H35}$)** | 842 | 6.32% | 6.11% | -0.0021 | 0.0412 | 0.896 |

- **Calibration Assessment:** Calibration-in-the-large is slightly negative (predicted < observed), reflecting conservative surge probability estimation.
- **Calibration Method:** Parametric logistic scaling against empirical cross-validation folds. Unsupported claims of isotonic regression have been retired.

---

## 5. Synthetic Staging Alert Thresholds

Alert tiers are computed in staging using synthetic evaluation thresholds:
- **Watch:** $p_E \ge \tau_{\text{watch}} = 0.40$
- **Advisory:** $p_E \ge \tau_{\text{advisory}} = 0.60$
- **Warning:** $p_H \ge \tau_{\text{warning}} = 0.70$ AND non-zero case plausibility ($C_{\text{fire}} = 1$)
- **Constraint:** Satellite flood proxy alone **never** triggers a Warning tier.
