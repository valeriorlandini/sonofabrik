"""
Auto-generated runner for "Untitled Song"
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
    "title": "Untitled Song",
    "tracks": [
      {
        "id": "track_1",
        "name": "Track 1",
        "items": [
          {
            "id": "item_1",
            "begin": 0,
            "length": 15.5,
            "prompt": "Female whispers in a germanic language, lightly sobbing, very quiet, in an unsettling voice"
          }
        ]
      },
      {
        "id": "track_2",
        "name": "Track 2",
        "items": [
          {
            "id": "item_2",
            "begin": 3.35,
            "length": 7.7,
            "prompt": "Glitches, electroacoustic noises, disturbs, interferences"
          },
          {
            "id": "item_3",
            "begin": 14.700000000000001,
            "length": 8.25,
            "prompt": "Glitches, electroacoustic noises, disturbs, interferences"
          }
        ]
      },
      {
        "id": "track_3",
        "name": "Track 3",
        "items": [
          {
            "id": "item_4",
            "begin": 0.35000000000000003,
            "length": 26.9,
            "prompt": "Low synthesizer drone with some very slow variations"
          }
        ]
      },
      {
        "id": "track_4",
        "name": "Track 4",
        "items": [
          {
            "id": "item_5",
            "begin": 17.35,
            "length": 13.7,
            "prompt": "Young woman speaking French at loud voice, very angry and disappointed"
          }
        ]
      }
    ]
  }
}
""")

with open("untitled_song.json", "w") as f:
    json.dump(SONG, f, indent=2)
print("Saved untitled_song.json\n")

# ── Generate clips ───────────────────────────────────────────────
pipe, device = load_model()
print(f"Generating 5 clip(s)...\n")

# item_1  |  begin=0s  length=15.5s
generate_audio(
    prompt="Female whispers in a germanic language, lightly sobbing, very quiet, in an unsettling voice",
    length=15.5,
    output_file="item_1.wav",
    pipe=pipe,
    device=device,
)
print("  ✓  item_1.wav")

# item_2  |  begin=3.35s  length=7.7s
generate_audio(
    prompt="Glitches, electroacoustic noises, disturbs, interferences",
    length=7.7,
    output_file="item_2.wav",
    pipe=pipe,
    device=device,
)
print("  ✓  item_2.wav")

# item_3  |  begin=14.700000000000001s  length=8.25s
generate_audio(
    prompt="Glitches, electroacoustic noises, disturbs, interferences",
    length=8.25,
    output_file="item_3.wav",
    pipe=pipe,
    device=device,
)
print("  ✓  item_3.wav")

# item_4  |  begin=0.35000000000000003s  length=26.9s
generate_audio(
    prompt="Low synthesizer drone with some very slow variations",
    length=26.9,
    output_file="item_4.wav",
    pipe=pipe,
    device=device,
)
print("  ✓  item_4.wav")

# item_5  |  begin=17.35s  length=13.7s
generate_audio(
    prompt="Young woman speaking French at loud voice, very angry and disappointed",
    length=13.7,
    output_file="item_5.wav",
    pipe=pipe,
    device=device,
)
print("  ✓  item_5.wav")

# ── Mix all clips ────────────────────────────────────────────────
mix_song("untitled_song.json", output_file="untitled_song_mix.wav")