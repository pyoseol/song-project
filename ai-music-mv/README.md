## AI Music MV API

This project can now run with real AI providers:

- Music: Hugging Face `facebook/musicgen-small`
- Images: Diffusers `runwayml/stable-diffusion-v1-5`

### Environment variables

- `MUSIC_PROVIDER=procedural` or `musicgen`
- `IMAGE_PROVIDER=procedural` or `diffusers`
- `MUSICGEN_MODEL_ID` to override the default music model
- `DIFFUSION_MODEL_ID` to override the default image model
- `HF_TOKEN` if the selected Hugging Face model requires authentication
- `ALLOW_PROVIDER_FALLBACK=true` to fall back to procedural generation if model loading fails
- `CORS_ALLOW_ORIGINS=*` to allow frontend requests during development

### Notes

- Default mode is procedural, so it starts immediately without model downloads
- Real AI mode downloads model weights into `./models`
- CPU works but is slow
- GPU is strongly recommended for `diffusers`
- MusicGen generation is effectively capped at 30 seconds

### Quick start

1. Copy `.env.example` to `.env`
2. Run `docker compose up --build`
3. Open `http://localhost:8000/docs`

If you want real AI generation instead of the instant local mode, set:

- `MUSIC_PROVIDER=musicgen`
- `IMAGE_PROVIDER=diffusers`

### Generate request

```json
{
  "prompt_music": "cinematic electronic track with emotional piano and strong drums",
  "prompt_visual": "neon city at night, rain, cinematic music video frame",
  "duration_sec": 15,
  "num_images": 6
}
```

### Result files

- Audio: `/outputs/<job_id>/music.wav`
- Video: `/outputs/<job_id>/mv.mp4`
- Images: `/outputs/<job_id>/cut_00.png` and so on

### Frontend flow

1. `POST /generate`
2. Read `job_id` and `status_url`
3. Poll `GET /jobs/{job_id}` until `status === "done"`
4. Use `result.audio_url` and `result.video_url`
