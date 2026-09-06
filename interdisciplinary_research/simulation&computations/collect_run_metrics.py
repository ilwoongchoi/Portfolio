#!work/usr/bin/env python3
"""Collect metrics.json drift data and neck-band hashes for a sweep batch."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Iterable


def iter_runs(out_root: Path, prefix: str) -> Iterable[Path]:
    pattern = f"{prefix}_r_*"
    for run_dir in sorted((out_root / "out" / "external_trackA" if False else out_root).glob(pattern)):
        yield run_dir


def compute_sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_metrics(run_dir: Path) -> dict[str, str | float | None]:
    metrics_path = run_dir / "metrics.json"
    geom_dir = run_dir / "geometry_map"
    data = json.loads(metrics_path.read_text(encoding="utf-8"))
    centerline = next(geom_dir.glob("neck_band_*_centerline.csv"), None)
    centerline_sha = compute_sha(centerline) if centerline else None
    return {
        "run_dir": run_dir.as_posix(),
        "metrics_json": metrics_path.as_posix(),
        "M2_drift_p95_unaligned": data.get("M2_drift_p95_unaligned"),
        "centerline": centerline.as_posix() if centerline else None,
        "centerline_sha256": centerline_sha,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect sweep metrics summary")
    parser.add_argument("--out-root", type=Path, default=Path("out"), help="Root containing external_trackA and synthetic_sh_sweeps")
    parser.add_argument("--run-prefix", required=True, help="Prefix of the run directories to inspect (e.g., sh_focus_v5fix2)")
    parser.add_argument("--summary-dir", type=Path, required=True, help="Directory to place run_metrics_summary.json")
    args = parser.parse_args()

    sweep_dir = args.summary_dir.resolve()
    sweep_dir.mkdir(parents=True, exist_ok=True)

    ext_root = args.out_root / "external_trackA"
    if not ext_root.exists():
        raise FileNotFoundError(ext_root)

    runs = []
    for run_dir in sorted(ext_root.glob(f"{args.run_prefix}_r_*")):
        metrics_path = run_dir / "metrics.json"
        geom_dir = run_dir / "geometry_map"
        if not (metrics_path.exists() and geom_dir.exists()):
            continue
        runs.append(collect_metrics(run_dir))

    summary_path = sweep_dir / "run_metrics_summary.json"
    summary_path.write_text(json.dumps(runs, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Written {summary_path.as_posix()}")


if __name__ == "__main__":
    main()