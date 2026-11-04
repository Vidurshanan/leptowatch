"""Configuration and paths. Every module gets settings from here."""
from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

PACKAGE_ROOT = Path(__file__).resolve().parents[2]          # .../leptowatch
CONFIG_DIR = PACKAGE_ROOT / "config"
SUBDIRS = ["raw/wer_pdfs", "raw/ee", "raw/boundaries", "raw/openmeteo", "interim",
           "processed", "models", "reports", "reports/figures", "ledger", "outputs"]

_CFG = None


def load_config(path: str | os.PathLike | None = None) -> dict:
    """Read config/config.yaml once and cache it."""
    global _CFG
    if _CFG is not None and path is None:
        return _CFG
    p = Path(path) if path else CONFIG_DIR / "config.yaml"
    if yaml is None:
        raise ImportError("pip install pyyaml")
    with open(p) as fh:
        cfg = yaml.safe_load(fh)
    if path is None:
        _CFG = cfg
    return cfg


def data_root() -> Path:
    """Data folder: env LW_DATA_ROOT wins, then config, then ./data next to the code."""
    env = os.environ.get("LW_DATA_ROOT")
    if env:
        root = Path(env)
    else:
        root = Path(load_config()["paths"]["data_root"])
        if not root.parent.exists():          # not in Colab with Drive mounted
            root = PACKAGE_ROOT / "data"
    for s in SUBDIRS:
        (root / s).mkdir(parents=True, exist_ok=True)
    return root


def path(*parts) -> Path:
    """data_root()/parts..., creating the parent folder."""
    p = data_root().joinpath(*parts)
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def rdhs_table() -> pd.DataFrame:
    return pd.read_csv(CONFIG_DIR / "rdhs.csv")


def rdhs_list() -> list[str]:
    return rdhs_table().rdhs.tolist()
