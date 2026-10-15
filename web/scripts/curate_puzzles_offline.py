#!/usr/bin/env python3
"""Offline Lichess Puzzle Curating Pipeline for Chegga Web.

Streams directly from a local zstd-compressed Lichess puzzle dump
(e.g. D:\\Chess\\Lichess-Puzzles\\lichess_db_puzzle.csv.zst), filters by
quality and thematic criteria, performs stratified sampling across Elo rating bands,
and outputs the exact compact JSON bundle expected by Chegga Web.

Usage Examples:
  # Standard 100k curated set for web/public/curated-puzzles.json
  python curate_puzzles_offline.py

  # Sliced theme pack for tactical mastery (e.g., Forks)
  python curate_puzzles_offline.py --theme fork --target 10000 --out ../public/puzzles-fork.json

  # Sliced Elo band for beginners (rating 800 to 1400)
  python curate_puzzles_offline.py --min-rating 800 --max-rating 1400 --target 25000 --out ../public/puzzles-beginner.json
"""

import argparse
import collections
import csv
import io
import json
import os
import sys
import time
from pathlib import Path
import zstandard

DEFAULT_DB_PATH = r"D:\Chess\Lichess-Puzzles\lichess_db_puzzle.csv.zst"
DEFAULT_OUT_PATH = str(Path(__file__).resolve().parent.parent / "public" / "curated-puzzles.json")

def parse_args():
    parser = argparse.ArgumentParser(description="Curate chess puzzles offline for Chegga Web")
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help="Path to lichess_db_puzzle.csv.zst")
    parser.add_argument("--out", default=DEFAULT_OUT_PATH, help="Output path for curated JSON")
    parser.add_argument("--target", type=int, default=100_000, help="Target total puzzles (default: 100,000)")
    parser.add_argument("--min-rating", type=int, default=600, help="Minimum rating (default: 600)")
    parser.add_argument("--max-rating", type=int, default=2500, help="Maximum rating (default: 2500)")
    parser.add_argument("--step", type=int, default=100, help="Rating band step size (default: 100)")
    parser.add_argument("--theme", type=str, default=None, help="Filter to a specific theme (e.g. fork, pin, endgame)")
    parser.add_argument("--min-pop", type=int, default=88, help="Minimum popularity (default: 88)")
    parser.add_argument("--min-plays", type=int, default=1000, help="Minimum plays (default: 1000)")
    parser.add_argument("--max-rd", type=int, default=90, help="Maximum rating deviation (default: 90)")
    return parser.parse_args()

def main():
    args = parse_args()

    if not os.path.exists(args.db):
        print(f"Error: Database file not found at {args.db}", file=sys.stderr)
        print("Please check that the external drive (D:) is connected.", file=sys.stderr)
        sys.exit(1)

    print(f"=== Chegga Web Offline Puzzle Pipeline ===", file=sys.stderr)
    print(f"Source DB:      {args.db}", file=sys.stderr)
    print(f"Target Output:  {args.out}", file=sys.stderr)
    print(f"Target Puzzles: {args.target:,}", file=sys.stderr)
    print(f"Rating Range:   {args.min_rating} - {args.max_rating} (step {args.step})", file=sys.stderr)
    if args.theme:
        print(f"Theme Filter:   '{args.theme}'", file=sys.stderr)
    print(f"Quality Floor:  Pop >= {args.min_pop}, Plays >= {args.min_plays:,}, RD <= {args.max_rd}", file=sys.stderr)
    print("------------------------------------------", file=sys.stderr)

    start_time = time.time()
    num_bands = max(1, (args.max_rating - args.min_rating) // args.step + 1)
    per_band = int(args.target * 1.05 // num_bands)
    per_band_theme = max(50, per_band // 7)

    dctx = zstandard.ZstdDecompressor()
    band_count = collections.Counter()
    band_theme_count = collections.defaultdict(collections.Counter)
    theme_total = collections.Counter()
    seen_fen = set()
    rows = []
    scanned = 0

    with open(args.db, "rb") as fh:
        stream = dctx.stream_reader(fh)
        text = io.TextIOWrapper(stream, encoding="utf-8", newline="")
        reader = csv.reader(text)

        header = next(reader)
        # Expected header: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate
        assert header[0] == "PuzzleId" and header[7] == "Themes", f"Unexpected header: {header}"

        filter_theme = args.theme.lower().strip() if args.theme else None

        for r in reader:
            scanned += 1
            if scanned % 500_000 == 0:
                elapsed = time.time() - start_time
                print(f"  ...scanned {scanned:,} rows ({scanned / elapsed:,.0f} rows/s), kept {len(rows):,}", file=sys.stderr)

            try:
                rating = int(r[3])
                rd = int(r[4])
                pop = int(r[5])
                plays = int(r[6])
            except (ValueError, IndexError):
                continue

            if rating < args.min_rating or rating > args.max_rating:
                continue

            themes = r[7].strip()
            if not themes:
                continue

            if pop < args.min_pop or plays < args.min_plays or rd > args.max_rd:
                continue

            fen = r[1]
            if fen in seen_fen:
                continue

            tlist = themes.split(" ")
            if filter_theme and filter_theme not in [t.lower() for t in tlist]:
                continue

            band = min(max(rating, args.min_rating), args.max_rating) // args.step * args.step
            if band_count[band] >= per_band:
                continue

            btc = band_theme_count[band]
            if not any(btc[t] < per_band_theme for t in tlist):
                continue

            seen_fen.add(fen)
            band_count[band] += 1
            for t in tlist:
                btc[t] += 1
                theme_total[t] += 1

            opening_tags = r[9].strip() if len(r) > 9 else ""
            rows.append([r[0], fen, r[2], rating, rd, pop, themes, opening_tags])

            if len(rows) >= int(args.target * 1.05):
                break

    # Proportional trimming
    if len(rows) > args.target:
        keep_frac = args.target / len(rows)
        per_band_keep = {b: max(1, int(c * keep_frac)) for b, c in band_count.items()}
        kept, taken = [], collections.Counter()
        for row in rows:
            b = min(max(row[3], args.min_rating), args.max_rating) // args.step * args.step
            if taken[b] < per_band_keep[b]:
                taken[b] += 1
                kept.append(row)
        rows = kept

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    payload = {
        "v": 1,
        "source": f"lichess_db_puzzle.csv CC0 (local fast curation, {time.strftime('%Y-%m-%d')})",
        "fields": ["id", "fen", "moves", "rating", "ratingDeviation", "popularity", "themes", "openingTags"],
        "rows": rows,
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)

    total_time = time.time() - start_time
    file_size_mb = os.path.getsize(args.out) / (1024 * 1024)

    print("------------------------------------------", file=sys.stderr)
    print(f"Finished in {total_time:.1f}s!", file=sys.stderr)
    print(f"Scanned: {scanned:,} rows")
    print(f"Output:  {len(rows):,} puzzles written to {args.out} ({file_size_mb:.2f} MB)", file=sys.stderr)
    print("\nRating Band Distribution:", file=sys.stderr)
    for b in sorted(band_count):
        bar = "#" * max(1, band_count[b] // max(1, (max(band_count.values()) // 30)))
        print(f"  {b:>4}-{b+args.step-1:<4}: {band_count[b]:>6}  {bar}", file=sys.stderr)
    print("\nTop 15 Themes in Curated Set:", file=sys.stderr)
    for t, c in theme_total.most_common(15):
        print(f"  {t:<22} {c:>7,}", file=sys.stderr)

if __name__ == "__main__":
    main()
