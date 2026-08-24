"""
mix_audio.py  –  Assembles generated clips into a single flat WAV mix.

Each clip is placed at its 'begin' timestamp; overlapping clips are summed.
No volume adjustment, no fades — raw placement only.

CLI usage:
    python mix_audio.py song.json
    python mix_audio.py song.json --output my_mix.wav

Import usage:
    from mix_audio import mix_song
    mix_song("song.json", output_file="mix.wav")
"""

import argparse
import json
from pathlib import Path

import numpy as np
import soundfile as sf


def mix_song(json_path: str, output_file: str = "mix.wav") -> None:
    with open(json_path) as f:
        data = json.load(f)

    song    = data["song"]
    title   = song.get("title", "Untitled")
    entries = []   # list of (begin_sec: float, audio: np.ndarray, sr: int)

    print(f'\nMixing "{title}"')
    print(f"  Reading clips...")

    for track in song["tracks"]:
        for item in track["items"]:
            wav_path = Path(f"{item['id']}.wav")
            if not wav_path.exists():
                print(f"  ⚠  {wav_path} not found — skipped")
                continue
            # always_2d → shape (samples, channels) even for mono files
            audio, sr = sf.read(str(wav_path), always_2d=True)
            entries.append((float(item["begin"]), audio, sr))
            print(f"  ✔  {wav_path}  [{item['begin']:.2f}s, {audio.shape[0]/sr:.2f}s long]")

    if not entries:
        print("  No audio files found — nothing to mix.")
        return

    # All clips should share the same sample rate (same model = same sr).
    sample_rate = entries[0][2]
    if any(sr != sample_rate for _, _, sr in entries):
        print("  ⚠  Warning: clips have different sample rates. Using first clip's rate.")

    # Final buffer dimensions
    total_samples = max(
        int(begin * sample_rate) + audio.shape[0]
        for begin, audio, _ in entries
    )
    n_channels = max(audio.shape[1] for _, audio, _ in entries)

    mix = np.zeros((total_samples, n_channels), dtype=np.float64)

    for begin, audio, sr in entries:
        start = int(begin * sr)
        end   = start + audio.shape[0]
        ch    = audio.shape[1]

        # Upmix mono → stereo (or higher) if needed
        if ch < n_channels:
            audio = np.tile(audio, (1, n_channels // ch))

        mix[start:end] += audio

    # Normalise: if any sample exceeds ±1.0, scale the whole mix down
    peak = np.max(np.abs(mix))
    if peak > 1.0:
        mix = mix / peak
        print(f"  ↓  Normalised peak {peak:.3f} → 1.000  (no clipping)")

    # Write as float32 WAV
    sf.write(output_file, mix.astype(np.float32), sample_rate)

    duration = total_samples / sample_rate
    print(f"\n  ✓  {len(entries)} clip(s)  |  {duration:.2f}s  |  {n_channels}ch  |  {sample_rate} Hz")
    print(f"  ✓  Saved: {output_file}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Mix Stable Audio clips according to a SonoFabrik JSON file."
    )
    parser.add_argument("json",           help="Path to the song JSON (e.g. song.json)")
    parser.add_argument("--output", "-o", default="mix.wav",
                        help="Output WAV filename (default: mix.wav)")
    args = parser.parse_args()
    mix_song(args.json, output_file=args.output)
