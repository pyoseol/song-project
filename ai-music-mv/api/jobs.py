import json
import os
import threading
import time
import uuid

from media import compose_mv, generate_images, generate_music
from modeling import analyze_music_prompt, analyze_visual_prompt, build_scene_plan
from settings import settings

OUTPUT_DIR = settings.output_dir
JOBS_FILE = os.path.join(OUTPUT_DIR, "jobs.json")

_lock = threading.Lock()


def _load_jobs():
    if not os.path.exists(JOBS_FILE):
        return {}
    with open(JOBS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_jobs(jobs):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(JOBS_FILE, "w", encoding="utf-8") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)


def create_job(payload: dict):
    job_id = uuid.uuid4().hex
    job = {
        "id": job_id,
        "status": "queued",
        "created_at": int(time.time()),
        "updated_at": int(time.time()),
        "payload": payload,
        "result": None,
        "error": None,
    }
    with _lock:
        jobs = _load_jobs()
        jobs[job_id] = job
        _save_jobs(jobs)
    return job


def get_job(job_id: str):
    with _lock:
        jobs = _load_jobs()
        return jobs.get(job_id)


def _update(job_id: str, **fields):
    with _lock:
        jobs = _load_jobs()
        if job_id not in jobs:
            return
        jobs[job_id].update(fields)
        jobs[job_id]["updated_at"] = int(time.time())
        _save_jobs(jobs)


def run_job_async(job_id: str):
    thread = threading.Thread(target=_run_job, args=(job_id,), daemon=True)
    thread.start()


def _run_job(job_id: str):
    job = get_job(job_id)
    if not job:
        return

    try:
        _update(job_id, status="running", error=None)

        payload = job["payload"]
        prompt_music = payload["prompt_music"]
        prompt_visual = payload["prompt_visual"]
        duration_sec = int(payload["duration_sec"])
        num_images = int(payload["num_images"])

        music_plan = analyze_music_prompt(prompt_music)
        visual_plan = analyze_visual_prompt(prompt_visual)
        scenes = build_scene_plan(prompt_visual, num_images)

        _update(job_id, status="music_generating")
        audio_path, music_generation = generate_music(job_id, prompt_music, duration_sec)

        _update(job_id, status="visual_generating")
        image_paths, image_generation = generate_images(job_id, prompt_visual, num_images)

        _update(job_id, status="compositing")
        video_path = compose_mv(job_id, audio_path, image_paths)

        _update(
            job_id,
            status="done",
            result={
                "audio": audio_path,
                "video": video_path,
                "audio_url": f"/outputs/{job_id}/music.wav",
                "video_url": f"/outputs/{job_id}/mv.mp4",
                "image_urls": [f"/outputs/{job_id}/cut_{scene.index:02d}.png" for scene in scenes],
                "music_plan": {
                    "bpm": music_plan.bpm,
                    "waveform": music_plan.waveform,
                    "energy": music_plan.energy,
                },
                "music_generation": music_generation,
                "visual_plan": {
                    "mood": visual_plan.mood,
                    "motif": visual_plan.motif,
                    "accent": visual_plan.accent,
                },
                "image_generation": {
                    "provider": image_generation["provider"],
                    "model": image_generation["model"],
                    "device": image_generation.get("device"),
                },
                "scenes": [
                    {
                        "title": scene.title,
                        "camera": scene.camera,
                        "motion": scene.motion,
                    }
                    for scene in scenes
                ],
            },
        )
    except Exception as e:
        _update(job_id, status="failed", error=str(e))
