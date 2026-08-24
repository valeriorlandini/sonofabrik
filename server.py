"""
server.py  –  SonoFabrik backend
Runs on http://localhost:8000

Endpoints:
  POST /generate          { item_id, prompt, length, negative_prompt?, num_inference_steps? }
  GET  /status/<item_id>  → { status: queued|generating|done|error, error?: str }
  GET  /audio/<item_id>.wav
  POST /mix               { song_data: {...} }  → WAV download
  GET  /health

Install (inside your venv):
  pip install flask flask-cors numpy soundfile

Run:
  source venv/bin/activate
  python server.py
"""

import threading
import queue
import traceback
import numpy as np
import soundfile as sf
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from generate_audio import generate_audio, load_model

# ── Config ────────────────────────────────────────────────────────────────────
AUDIO_DIR           = Path("audio")
AUDIO_DIR.mkdir(exist_ok=True)
PORT                = 8000
MAX_GENERATION_SECS = 47.0

app = Flask(__name__)
CORS(app)

job_queue  = queue.Queue()
job_status = {}
job_lock   = threading.Lock()


def worker():
    while True:
        job = job_queue.get()
        item_id = job["item_id"]
        try:
            with job_lock:
                job_status[item_id] = {"status": "generating", "error": None}

            print(f"  ▶  {item_id}  steps={job.get('num_inference_steps', 300)}"
                  f"  prompt={job['prompt'][:55]!r}")

            generate_audio(
                prompt              = job["prompt"],
                length              = float(job.get("length", 10.0)),
                negative_prompt     = job.get("negative_prompt", ""),
                output_file         = str(AUDIO_DIR / f"{item_id}.wav"),
                pipe                = pipe,
                device              = device,
                num_inference_steps = int(job.get("num_inference_steps", 300)),
            )

            with job_lock:
                job_status[item_id] = {"status": "done", "error": None}
            print(f"  ✓  {item_id}.wav")

        except Exception as exc:
            with job_lock:
                job_status[item_id] = {"status": "error", "error": str(exc)}
            traceback.print_exc()
        finally:
            job_queue.task_done()


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/generate", methods=["POST"])
def generate():
    data    = request.get_json(force=True)
    item_id = data.get("item_id", "").strip()

    if not item_id:
        return jsonify({"error": "item_id is required"}), 400
    if not data.get("prompt", "").strip():
        return jsonify({"error": "prompt is required"}), 400

    try:
        length = float(data.get("length", 10.0))
    except (TypeError, ValueError):
        return jsonify({"error": "length must be a number"}), 400

    if length <= 0:
        return jsonify({"error": "length must be > 0"}), 400
    if length > MAX_GENERATION_SECS:
        return jsonify({"error": f"length must be ≤ {MAX_GENERATION_SECS:g}s"}), 400

    data["length"] = length

    with job_lock:
        current = job_status.get(item_id, {}).get("status")
        if current in ("queued", "generating"):
            return jsonify({"status": current}), 200

        old_wav = AUDIO_DIR / f"{item_id}.wav"
        if old_wav.exists():
            old_wav.unlink()
            print(f"  ×  Deleted stale {old_wav.name} (re-generation)")

        job_status[item_id] = {"status": "queued", "error": None}

    job_queue.put(data)
    print(f"  ·  Queued {item_id}  (depth: {job_queue.qsize()})")
    return jsonify({"status": "queued"}), 202


@app.route("/status/<item_id>", methods=["GET"])
def status(item_id):
    with job_lock:
        s = job_status.get(item_id)

    if s is None:
        if (AUDIO_DIR / f"{item_id}.wav").exists():
            return jsonify({"status": "done", "error": None})
        return jsonify({"status": "unknown", "error": None})

    return jsonify(s)


@app.route("/audio/<path:filename>", methods=["GET"])
def serve_audio(filename):
    return send_from_directory(AUDIO_DIR, filename)


def apply_equal_power_pan(audio: np.ndarray, pan: float, vol: float) -> np.ndarray:
    """
    Apply volume scaling and equal-power stereo panning to a (samples, channels) array.

    pan  : -1.0 (hard left) … 0.0 (centre) … +1.0 (hard right)
    vol  : 0.0 … 1.0 (track volume multiplier)

    Equal-power law:
        angle = (pan + 1) / 2 * π/2       maps pan[-1,+1] → angle[0, π/2]
        left_gain  = cos(angle) * √2
        right_gain = sin(angle) * √2
    The √2 factor keeps perceived loudness constant across the pan range
    (centre pan produces 1.0 gain on both channels).
    """
    pan   = float(np.clip(pan, -1.0, 1.0))
    vol   = float(np.clip(vol,  0.0, 4.0))   # allow slight boost (up to +12 dB)
    angle = (pan + 1.0) / 2.0 * (np.pi / 2.0)
    lg    = np.cos(angle) * np.sqrt(2.0) * vol
    rg    = np.sin(angle) * np.sqrt(2.0) * vol

    samples = audio.shape[0]
    n_ch    = audio.shape[1]

    out = np.zeros((samples, 2), dtype=np.float64)

    if n_ch == 1:
        # Mono source → both channels
        out[:, 0] = audio[:, 0] * lg
        out[:, 1] = audio[:, 0] * rg
    else:
        # Stereo (or more): use first two channels
        out[:, 0] = audio[:, 0] * lg
        out[:, 1] = audio[:, 1] * rg

    return out


@app.route("/mix", methods=["POST"])
def mix_route():
    """
    Build a stereo mix from all 'done' WAV files using current item positions,
    track volume and track pan.

    Expected JSON body:
    {
      "song_data": {
        "song": {
          "title": "...",
          "tracks": [
            {
              "id": "...",
              "name": "...",
              "volume": 1.0,
              "pan": 0.0,
              "items": [
                { "id": "<internal item id>", "begin": 0.0, "length": 5.0 }
              ]
            }
          ]
        }
      }
    }
    """
    data      = request.get_json(force=True)
    song_data = data.get("song_data")
    if not song_data:
        return jsonify({"error": "song_data is required"}), 400

    entries = []   # (begin_sec, processed_stereo_ndarray, sample_rate)
    missing = []

    for track in song_data.get("song", {}).get("tracks", []):
        vol = float(track.get("volume", 1.0))
        pan = float(track.get("pan",    0.0))

        for item in track.get("items", []):
            wav_path = AUDIO_DIR / f"{item['id']}.wav"
            if not wav_path.exists():
                missing.append(item["id"])
                continue
            try:
                audio, sr = sf.read(str(wav_path), always_2d=True)
                # Apply volume + pan → always returns (samples, 2) stereo
                processed = apply_equal_power_pan(audio, pan, vol)
                entries.append((float(item.get("begin", 0.0)), processed, sr))
            except Exception as e:
                print(f"  ⚠  Could not read {wav_path}: {e}")

    if not entries:
        msg = "No audio files found."
        if missing:
            msg += f" Missing: {', '.join(missing[:5])}"
        return jsonify({"error": msg}), 400

    if missing:
        print(f"  ⚠  Skipped: {missing}")

    base_sr       = entries[0][2]
    total_samples = max(int(b * sr) + a.shape[0] for b, a, sr in entries)
    mix           = np.zeros((total_samples, 2), dtype=np.float64)

    for begin, audio, sr in entries:
        start = int(begin * sr)
        end   = start + audio.shape[0]
        mix[start:end] += audio

    # Peak-normalise only if clipping would occur
    peak = np.abs(mix).max()
    if peak > 1.0:
        mix /= peak
        print(f"  ↓  Peak-normalised: {peak:.3f} → 1.000")

    slug        = song_data["song"].get("title", "mix").replace(" ", "_").lower()
    output_name = f"{slug}_mix.wav"
    output_path = AUDIO_DIR / output_name
    sf.write(str(output_path), mix.astype(np.float32), base_sr)

    duration = total_samples / base_sr
    print(f"  ✓  Mix: {len(entries)} clips · {duration:.2f}s · stereo → {output_name}")

    return send_from_directory(
        AUDIO_DIR, output_name,
        as_attachment=True,
        download_name=output_name,
    )


# ── Startup ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Loading Stable Audio model…")
    pipe, device = load_model()
    print(f"Model ready on {device}.\n")

    t = threading.Thread(target=worker, daemon=True)
    t.start()

    print(f"SonoFabrik server running at http://localhost:{PORT}\n")
    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)