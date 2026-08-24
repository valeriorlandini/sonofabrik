import argparse
import random
import torch
import soundfile as sf
from diffusers import StableAudioPipeline

MAX_GENERATION_SECS = 47.0


def load_model():
    pipe = StableAudioPipeline.from_pretrained("stable-audio-open-1.0", torch_dtype=torch.float16)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipe = pipe.to(device)
    return pipe, device

def generate_audio(prompt, length = 10.0, negative_prompt = "", output_file = "output.wav", pipe = None, device = None, num_inference_steps = 300):
    if pipe is None or device is None:
        pipe, device = load_model()
    length = float(length)
    if length <= 0:
        raise ValueError("length must be greater than 0 seconds")
    if length > MAX_GENERATION_SECS:
        raise ValueError(f"length must be <= {MAX_GENERATION_SECS:g} seconds")

    generator = torch.Generator(device).manual_seed(torch.seed())

    audio = pipe(
        prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=num_inference_steps,
        audio_end_in_s=length,
        num_waveforms_per_prompt=1,
        generator=generator,
    ).audios

    output = audio[0].T.float().cpu().numpy()
    sf.write(output_file, output, pipe.vae.sampling_rate)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate audio from text prompts using Stable Audio Open 1.0")
    parser.add_argument("--prompt", type=str, required=True, help="The text prompt to generate audio from")
    parser.add_argument("--length", type=float, default=10.0, help="Length of the generated audio in seconds")
    parser.add_argument("--negative_prompt", type=str, default="", help="Negative prompt to guide the generation")
    parser.add_argument("--output_file", type=str, default="output.wav", help="Path to save the generated audio file")
    parser.add_argument("--num_inference_steps", type=int, default=300, help="Number of inference steps for generation")

    args = parser.parse_args()

    pipe, device = load_model()
    
    generate_audio(
        prompt=args.prompt,
        length=args.length,
        negative_prompt=args.negative_prompt,
        output_file=args.output_file,
        num_inference_steps=args.num_inference_steps,
        pipe=pipe,
        device=device
    )
