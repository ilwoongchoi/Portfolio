#!/usr/bin/env python3
"""Repair a synthetic SH sweep CSV after partial Track-A failures.

Purpose
-------
When Track-A failed early (exit code 2), run_sh_trackA_sweep.py recorded a
"trackA_fail" note and left metrics_path/m2/centerline fields empty.

After we re-run Track-A (typically with --tolerant-geometry), metrics.json may
exist. This script reconciles the sweep CSV with the on-disk run directories.

It does NOT change any metric definitions; it only fills missing fields based on
existing artifacts.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pandas as pd


ROOT = Path(__file__).resolve().parent.parent.parent


@dataclass
class RunArtifacts:
    run_dir: Path
    metrics_json: Path
    m2: Optional[float]
    centerline_path: Optional[Path]
    centerline_nonempty: Optional[bool]


def _load_metrics(metrics_json: Path) -> Optional[float]:
    try:
        data = json.loads(metrics_json.read_text(encoding="utf-8"))
    except Exception:
        return None
    m2 = data.get("M2_drift_p95_unaligned")
    return float(m2) if m2 is not None else None


def _find_centerline(geom_dir: Path) -> Optional[Path]:
    if not geom_dir.exists():
        return None
    # Prefer a canonical neck_band centerline if present.
    cands = sorted(geom_dir.glob("neck_band_*_centerline.csv"))
    if cands:
        return cands[0]
    # Otherwise accept any centerline.
    cands2 = sorted(geom_dir.glob("*centerline*.csv"))
    return cands2[0] if cands2 else None


def _centerline_nonempty(path: Optional[Path]) -> Optional[bool]:
    if path is None or not path.exists():
        return None
    try:
        df = pd.read_csv(path)
        return bool(len(df) > 0)
    except Exception:
        return None


def resolve_artifacts(run_id: str, out_root: Path) -> Optional[RunArtifacts]:
    run_dir = (out_root / "external_trackA" / run_id).resolve()
    if not run_dir.exists():
        return None
    metrics_json = run_dir / "metrics.json"
    if not metrics_json.exists():
        return None
    geom_dir = run_dir / "geometry_map"
    centerline = _find_centerline(geom_dir)
    return RunArtifacts(
        run_dir=run_dir,
        metrics_json=metrics_json,
        m2=_load_metrics(metrics_json),
        centerline_path=centerline,
        centerline_nonempty=_centerline_nonempty(centerline),
    )


def repair_csv(csv_path: Path, out_root: Path, in_place: bool) -> tuple[pd.DataFrame, int]:
    df = pd.read_csv(csv_path)
    changed = 0
    for i, row in df.iterrows():
        run_id = str(row.get("run_id", "") or "")
        if not run_id:
            continue

        art = resolve_artifacts(run_id, out_root)
        if art is None:
            continue

        # Fill metrics_path and m2 fields when missing.
        metrics_path_val = row.get("metrics_path")
        m2_val = row.get("m2driftp95")
        centerline_val = row.get("centerline_nonempty")

        need_update = False

        if pd.isna(metrics_path_val) or str(metrics_path_val).strip() == "":
            df.at[i, "metrics_path"] = str(art.metrics_json).replace("\\", "/")
            need_update = True

        if (pd.isna(m2_val) or m2_val == "") and art.m2 is not None:
            df.at[i, "m2driftp95"] = float(art.m2)
            need_update = True

        if (pd.isna(centerline_val) or centerline_val == "") and art.centerline_nonempty is not None:
            df.at[i, "centerline_nonempty"] = bool(art.centerline_nonempty)
            need_update = True

        # If we previously marked a trackA failure but metrics.json exists now,
        # annotate as repaired (do not erase history).
        notes = str(row.get("notes") or "")
        if "trackA_fail" in notes and art.metrics_json.exists() and "repaired" not in notes:
            df.at[i, "notes"] = (notes + ";" if notes else "") + "repaired_from_metrics_json"
            need_update = True

        if need_update:
            changed += 1

    if in_place:
        df.to_csv(csv_path, index=False, lineterminator="\n")
    return df, changed


def main() -> None:
    ap = argparse.ArgumentParser(description="Repair sweep result CSV by filling fields from run_dir artifacts")
    ap.add_argument("--sweep-dir", required=True, type=Path, help="Sweep directory under out/synthetic_sh_sweeps/<ts>")
    ap.add_argument("--out-root", default=Path("out"), type=Path, help="Repo out/ root (default: out)")
    ap.add_argument("--in-place", action="store_true", help="Write back into sh_r_sweep_results*.csv")
    args = ap.parse_args()

    sweep_dir = args.sweep_dir.resolve()
    out_root = (ROOT / args.out_root).resolve() if not args.out_root.is_absolute() else args.out_root.resolve()

    for name in ("sh_r_sweep_results_live.csv", "sh_r_sweep_results.csv"):
        csv_path = sweep_dir / name
        if not csv_path.exists():
            continue
        _, changed = repair_csv(csv_path, out_root=out_root, in_place=bool(args.in_place))
        print(f"{name}: changed_rows={changed}")


if __name__ == "__main__":
    main()
