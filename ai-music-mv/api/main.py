from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from jobs import create_job, get_job, run_job_async
from providers import get_provider_config
from settings import settings

app = FastAPI(title="AI Music + MV")
allow_origins = [origin.strip() for origin in settings.cors_allow_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/outputs", StaticFiles(directory=settings.output_dir), name="outputs")


class GenerateReq(BaseModel):
    prompt_music: str = Field(min_length=3)
    prompt_visual: str = Field(min_length=3)
    duration_sec: int = 20
    num_images: int = 6


@app.get("/")
def root():
    return {
        "service": "ai-music-mv",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "providers": get_provider_config(),
    }


@app.post("/generate")
def generate(req: GenerateReq):
    if req.duration_sec < 5 or req.duration_sec > 60:
        raise HTTPException(400, "duration_sec must be between 5 and 60 seconds")
    if req.num_images < 3 or req.num_images > 12:
        raise HTTPException(400, "num_images must be between 3 and 12")

    job = create_job(req.model_dump())
    run_job_async(job["id"])
    return {
        "job_id": job["id"],
        "status": "queued",
        "status_url": f"/jobs/{job['id']}",
    }


@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job
