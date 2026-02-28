import os
import subprocess

from modeling import analyze_music_prompt, analyze_visual_prompt, build_scene_plan
from providers import resolve_image_provider, resolve_music_provider
from settings import settings

OUTPUT_DIR = settings.output_dir


def generate_music(job_id: str, prompt: str, duration_sec: int) -> tuple[str, dict]:
    os.makedirs(os.path.join(OUTPUT_DIR, job_id), exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, job_id, "music.wav")

    provider = resolve_music_provider()
    metadata = provider.generate(
        prompt=prompt,
        duration_sec=duration_sec,
        output_path=output_path,
        prompt_plan=analyze_music_prompt(prompt),
    )
    return output_path, metadata


def generate_images(job_id: str, prompt: str, num_images: int) -> tuple[list[str], dict]:
    os.makedirs(os.path.join(OUTPUT_DIR, job_id), exist_ok=True)

    scenes = build_scene_plan(prompt, num_images)
    provider = resolve_image_provider()
    metadata = provider.generate(
        output_dir=os.path.join(OUTPUT_DIR, job_id),
        prompt=prompt,
        scenes=scenes,
        prompt_plan=analyze_visual_prompt(prompt),
    )
    return metadata["image_paths"], metadata


def compose_mv(job_id: str, audio_path: str, image_paths: list[str]) -> str:
    out_dir = os.path.join(OUTPUT_DIR, job_id)
    out_video = os.path.join(out_dir, "mv.mp4")
    concat_txt = os.path.join(out_dir, "images.txt")

    per = 3
    with open(concat_txt, "w", encoding="utf-8") as f:
        for path in image_paths:
            f.write(f"file '{path}'\n")
            f.write(f"duration {per}\n")
        f.write(f"file '{image_paths[-1]}'\n")

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concat_txt,
        "-i",
        audio_path,
        "-vf",
        "format=yuv420p,scale=1280:720",
        "-shortest",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-c:a",
        "aac",
        out_video,
    ]
    subprocess.run(cmd, check=True)
    return out_video
