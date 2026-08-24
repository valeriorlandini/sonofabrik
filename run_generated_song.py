"""
Auto-generated runner for "Generated Song"
Requires in the same directory:
  • generate_audio.py  (Stable Audio wrapper)
  • mix_audio.py       (SonoFabrik mixer)
"""

import json
from generate_audio import generate_audio, load_model
from mix_audio import mix_song

# ── Embedded song data ───────────────────────────────────────────
SONG = json.loads(r"""
{
  "song": {
    "title": "Generated Song",
    "tracks": [
      {
        "id": "track_1",
        "name": "Vocals",
        "items": [
          {
            "id": "item_1",
            "begin": 0.30000000000000004,
            "length": 10.3,
            "prompt": "Cat meow"
          }
        ]
      },
      {
        "id": "track_2",
        "name": "Instruments",
        "items": [
          {
            "id": "item_2",
            "begin": 1.25,
            "length": 2.85,
            "prompt": "Glacial death"
          },
          {
            "id": "item_3",
            "begin": 5.4,
            "length": 5.9,
            "prompt": "Death sounds"
          }
        ]
      },
      {
        "id": "track_3",
        "name": "Drums",
        "items": [
          {
            "id": "item_4",
            "begin": 23.25,
            "length": 5.95,
            "prompt": "Drums a lot"
          },
          {
            "id": "item_5",
            "begin": 29.5,
            "length": 8.8,
            "prompt": "More drums"
          }
        ]
      }
    ]
  }
}
""")

with open("generated_song.json", "w") as f:
    json.dump(SONG, f, indent=2)
print("Saved generated_song.json\n")

# ── Generate clips ───────────────────────────────────────────────
pipe, device = load_model()
print(f"Generating 5 clip(s)...\n")

# item_1  |  begin=0.30000000000000004s  length=10.3s
generate_audio(
    prompt="Cat meow",
    length=10.3,
    output_file="item_1.wav",
    pipe=pipe,
    device=device,
)
print("  ✓  item_1.wav")

# item_2  |  begin=1.25s  length=2.85s
generate_audio(
    prompt="Glacial death",
    length=2.85,
    output_file="item_2.wav",
    pipe=pipe,
    device=device,
)
print("  ✓  item_2.wav")

# item_3  |  begin=5.4s  length=5.9s
generate_audio(
    prompt="Death sounds",
    length=5.9,
    output_file="item_3.wav",
    pipe=pipe,
    device=device,
)
print("  ✓  item_3.wav")

# item_4  |  begin=23.25s  length=5.95s
generate_audio(
    prompt="Drums a lot",
    length=5.95,
    output_file="item_4.wav",
    pipe=pipe,
    device=device,
)
print("  ✓  item_4.wav")

# item_5  |  begin=29.5s  length=8.8s
generate_audio(
    prompt="More drums",
    length=8.8,
    output_file="item_5.wav",
    pipe=pipe,
    device=device,
)
print("  ✓  item_5.wav")

# ── Mix all clips ────────────────────────────────────────────────
mix_song("generated_song.json", output_file="generated_song_mix.wav")