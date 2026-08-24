# SonoFabrik

**SonoFabrik** is a middleware for creating sound objects from natural-language prompts using open-source neural audio models, and arranging them in a DAW-like environment.

Generated sounds can be exported as individual audio files or as a complete mix. SonoFabrik can also export **REAPER projects** and **Python scripts** for the underlying command-line-driven audio generation engine.

## Installation

Clone or download the repository, then open a terminal in the `sonofabrik` directory.

### 1. Install Node.js dependencies

```console
npm install
```

### 2. Install Python dependencies

It is recommended to use a Python virtual environment:

```console
python -m venv .venv
```

Activate it and install the required packages:

```console
pip install -r requirements.txt
```

### 3. Download Stable Audio Open

Download **[Stable Audio Open 1.0](https://huggingface.co/stabilityai/stable-audio-open-1.0)** from Hugging Face.

Place the downloaded `stable-audio-open-1.0` directory inside the root of the SonoFabrik repository:

```text
sonofabrik/
├── stable-audio-open-1.0/
├── server.py
├── requirements.txt
├── package.json
└── ...
```

## Running SonoFabrik

SonoFabrik consists of a Python backend and a web-based graphical interface. Start the backend first:

```console
python server.py
```

Then, in a second terminal, launch the development server:

```console
npm run dev
```

Once the server has started, open your browser at:

**http://localhost:5173/**

Have fun with SonoFabrik!
