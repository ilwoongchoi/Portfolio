# atlas_gate_v22.py
# Independent verification gate for PI_ATLAS_V2.2_EVIDENCE_PACKET.zip
# Usage: python atlas_gate_v22.py [ZIP_PATH]

import hashlib
import json
import os
import sys
import tempfile
import zipfile
import csv
from collections import defaultdict

ZIP_PATH = sys.argv[1] if len(sys.argv) > 1 else "PI_ATLAS_V2.2_EVIDENCE_PACKET.zip"

REQUIRED = [
    "ATLAS_V2.2/tables/atlas_registry.csv",
    "ATLAS_V2.2/tables/atlas_boundary_band_long.csv",
    "ATLAS_V2.2/tables/atlas_contact_pairs_long.csv",
    "ATLAS_V2.2/tables/atlas_gap_pairs_long.csv",
    "ATLAS_V2.2/tables/atlas_hubness_long.csv",
    "ATLAS_V2.2/tables/atlas_ridge_neckband_long.csv",
    "ATLAS_V2.2/UNIVERSAL_CORE_v2.2.json",
    "ATLAS_V2.2/SHA256_MANIFEST.csv",
]


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def die(msg):
    print("FAIL:", msg)
    sys.exit(1)


def read_csv_rows(path):
    with open(path, "r", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def unique_key_check(rows, keys, name):
    seen = set()
    for r in rows:
        k = tuple(r.get(x, "") for x in keys)
        if k in seen:
            die(f"{name}: duplicate key {keys}={k}")
        seen.add(k)


def main():
    print("=" * 80)
    print("ATLAS V2.2 INDEPENDENT VERIFICATION GATE")
    print("=" * 80)
    print(f"\nZIP_PATH: {ZIP_PATH}")
    
    if not os.path.exists(ZIP_PATH):
        die(f"ZIP file not found: {ZIP_PATH}")
    
    # 1) zip sha
    print("\n[1/5] Computing ZIP SHA256...")
    with open(ZIP_PATH, "rb") as f:
        zip_data = f.read()
        zip_sha = sha256_bytes(zip_data)
    print(f"  zip_sha256: {zip_sha}")
    print(f"  zip_size: {len(zip_data):,} bytes")
    
    # 2) Extract and check required files
    print("\n[2/5] Checking required files in ZIP...")
    with zipfile.ZipFile(ZIP_PATH, "r") as z:
        names = set(z.namelist())
        for req in REQUIRED:
            if req not in names:
                die(f"missing required file in zip: {req}")
            print(f"  OK: {req}")
        
        with tempfile.TemporaryDirectory() as td:
            print("\n[3/5] Extracting ZIP contents...")
            z.extractall(td)
            
            # 4) manifest fixity check
            print("\n[4/5] Verifying SHA256_MANIFEST.csv fixity...")
            manifest_path = os.path.join(td, "ATLAS_V2.2", "SHA256_MANIFEST.csv")
            manifest_rows = read_csv_rows(manifest_path)
            
            if not manifest_rows:
                die("manifest is empty")
            
            # Detect column names
            first_row = manifest_rows[0]
            path_col = None
            hash_col = None
            
            for col in first_row.keys():
                if col.lower() in ['filename', 'file', 'path']:
                    path_col = col
                if col.lower() in ['sha256', 'hash']:
                    hash_col = col
            
            if not path_col:
                die("manifest missing path/filename column")
            if not hash_col:
                die("manifest missing sha256/hash column")
            
            print(f"  Using columns: {path_col} -> {hash_col}")
            
            for r in manifest_rows:
                rel = r[path_col].replace("\\", "/")
                expected = r[hash_col].strip().lower()
                abs_path = os.path.join(td, rel)
                
                if not os.path.exists(abs_path):
                    # Try with ATLAS_V2.2 prefix
                    abs_path = os.path.join(td, "ATLAS_V2.2", rel)
                if not os.path.exists(abs_path):
                    abs_path = os.path.join(td, "ATLAS_V2.2", "tables", rel)
                if not os.path.exists(abs_path):
                    die(f"manifest references missing file: {rel}")
                
                with open(abs_path, "rb") as f:
                    got = sha256_bytes(f.read())
                
                if got != expected:
                    die(f"hash mismatch: {rel}\n  expected={expected}\n  got={got}")
                
                print(f"  OK: {rel}")
            
            # 5) schema + invariants
            print("\n[5/5] Validating schema and invariants...")
            
            core_path = os.path.join(td, "ATLAS_V2.2", "UNIVERSAL_CORE_v2.2.json")
            with open(core_path, "r", encoding="utf-8") as f:
                core = json.load(f)
            
            gs = core.get("global_stats", {})
            if not gs:
                die("UNIVERSAL_CORE missing global_stats")
            
            print(f"  Atlas version: {core.get('atlas_version', 'UNKNOWN')}")
            print(f"  Domains: {core.get('n_domains', 0)}")
            
            # boundary band schema check
            bb_path = os.path.join(td, "ATLAS_V2.2", "tables", "atlas_boundary_band_long.csv")
            bb = read_csv_rows(bb_path)
            
            for col in ["packet_id", "domain", "axis_name", "axis_value", "thickness"]:
                if col not in bb[0]:
                    die(f"boundary_band_long missing column: {col}")
            
            unique_key_check(bb, ["packet_id", "domain", "axis_name", "axis_value"], "boundary_band_long")
            print(f"  boundary_band_long: {len(bb)} rows, schema OK")
            
            # registry schema check
            reg_path = os.path.join(td, "ATLAS_V2.2", "tables", "atlas_registry.csv")
            reg = read_csv_rows(reg_path)
            
            if "packet_id" not in reg[0]:
                die("registry missing packet_id")
            
            unique_key_check(reg, ["packet_id"], "registry")
            print(f"  registry: {len(reg)} rows, schema OK")
            
            # contact pairs
            cp_path = os.path.join(td, "ATLAS_V2.2", "tables", "atlas_contact_pairs_long.csv")
            cp = read_csv_rows(cp_path)
            print(f"  contact_pairs_long: {len(cp)} rows")
            
            # gap pairs
            gp_path = os.path.join(td, "ATLAS_V2.2", "tables", "atlas_gap_pairs_long.csv")
            gp = read_csv_rows(gp_path)
            print(f"  gap_pairs_long: {len(gp)} rows")
            
            # hubness
            hb_path = os.path.join(td, "ATLAS_V2.2", "tables", "atlas_hubness_long.csv")
            hb = read_csv_rows(hb_path)
            print(f"  hubness_long: {len(hb)} rows")
            
            # ridge/neckband
            rn_path = os.path.join(td, "ATLAS_V2.2", "tables", "atlas_ridge_neckband_long.csv")
            rn = read_csv_rows(rn_path)
            print(f"  ridge_neckband_long: {len(rn)} rows")
            
            # counts match
            checks = [
                ("total_boundary_band_records", len(bb)),
                ("total_contact_pairs", len(cp)),
                ("total_gap_pairs", len(gp)),
                ("total_hubness_records", len(hb)),
                ("total_ridge_neckband_records", len(rn)),
            ]
            
            for stat_name, actual in checks:
                expected = gs.get(stat_name)
                if expected is not None and expected != actual:
                    die(f"global_stats mismatch: {stat_name}={expected} but table has {actual}")
                print(f"  {stat_name}: {actual} (matches)")
    
    print("\n" + "=" * 80)
    print("PASS: v2.2 evidence packet verifies cleanly.")
    print("=" * 80)
    return 0


if __name__ == "__main__":
    sys.exit(main())
