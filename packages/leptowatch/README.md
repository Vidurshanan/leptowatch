# LeptoWatch

Leptospirosis surge early warning for the 26 RDHS areas of Sri Lanka, 3 to 5 weeks ahead,
using case reports, rainfall, soil moisture and a Sentinel-1 radar signal of seasonal farmland wetting.
ModelX 2.0 (IEEE CIS, IIT) · team RootBotZ (Kirubakaran Premashainath, Kumareswaran Vidurshanan).

> The full start-to-finish guide is the book **LeptoWatch_Build_Book.pdf**. This README is the map.

## Quick start (Google Colab + Drive)

1. Upload `leptowatch_pack.zip` to `My Drive/LeptoWatch/`.
2. Open `notebooks/00_setup_and_tests.ipynb` in Colab, run all cells → `ALL TESTS PASSED`.
3. Follow notebooks 01 → 11 in order (book chapters in each notebook's first cell).

## What is where

| Folder | What |
|---|---|
| `config/` | `config.yaml` (every setting), `rdhs.csv` (26 areas), Kalmunai DS list, manual fixes |
| `src/leptowatch/data/` | WER download, parser v0.3, audit, case panel, boundaries, Earth Engine, Open-Meteo, weekly environment table |
| `src/leptowatch/features/` | as-of feature table, endemic channel, surge targets |
| `src/leptowatch/models/` | B0, B1, B2, detectors A–D, NB GLM with distributed lags, blend + calibration + CQR/ACI |
| `src/leptowatch/eval/` | rolling-origin backtest, metrics, tuning (Optuna), Model Doctor, ablation (H1), report |
| `src/leptowatch/alerts/` | ordered alert rules, watchdog, hash-chained ledger, Telegram/email, PDF bulletin |
| `src/leptowatch/api/` | FastAPI read-only API |
| `src/leptowatch/pipeline.py` | `prepare`, `offline`, `train-final`, `weekly` |
| `notebooks/` | 13 Colab notebooks, one per stage |
| `gee/` | Earth Engine Code Editor scripts (fallbacks and the original evidence-kit scripts) |
| `dashboard/` | Streamlit reference dashboard; `cursor_prompts/` has the prompts to build the full UI in Cursor |
| `tests/` | 10 tests incl. the time-travel leakage test and the synthetic planted-effect test |

## Commands

```bash
pip install -r requirements.txt && pip install -e .
python tests/run_all.py
python -m leptowatch.pipeline prepare        # parse, audit, cases, environment, features
python -m leptowatch.eval.tuning             # hyperparameters (leave-one-season-out)
python -m leptowatch.pipeline offline        # backtest, blend, report, alert thresholds
python -m leptowatch.eval.doctor             # overfitting / underfitting / calibration / leakage
python -m leptowatch.eval.ablation           # H1: does the radar signal help?
python -m leptowatch.pipeline train-final
python -m leptowatch.pipeline weekly         # every Monday
streamlit run dashboard/app.py
uvicorn leptowatch.api.app:app
```

## Honesty rules built into the code
- Features only use data available on the issue date (tested). The locked test runs once (lock file).
- Thresholds are tuned on pre-test years and frozen. Missing or stale data → "Unverified", never "safe".
- Every forecast is committed to a hash-chained ledger before the outcome is known.

Data sources and licences: see the proposal (Section 5.1) and `docs/DATA_SOURCES.md`.
