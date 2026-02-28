import math
import os
import struct
import threading
import wave
from abc import ABC, abstractmethod

from PIL import Image, ImageDraw, ImageFilter, ImageOps

from modeling import note_frequency
from settings import settings

MODEL_CACHE_DIR = settings.model_cache_dir


class MusicProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str, duration_sec: int, output_path: str, prompt_plan) -> dict:
        raise NotImplementedError


class ImageProvider(ABC):
    @abstractmethod
    def generate(self, output_dir: str, prompt: str, scenes: list, prompt_plan) -> dict:
        raise NotImplementedError


class ProceduralMusicProvider(MusicProvider):
    def generate(self, prompt: str, duration_sec: int, output_path: str, prompt_plan) -> dict:
        fr = 44100
        beat_samples = max(1, int(fr * 60 / prompt_plan.bpm))
        nframes = duration_sec * fr

        with wave.open(output_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(fr)

            for i in range(nframes):
                t = i / fr
                beat_index = i // beat_samples
                note_step = prompt_plan.scale_steps[beat_index % len(prompt_plan.scale_steps)]
                bass_step = prompt_plan.scale_steps[(beat_index // 4) % len(prompt_plan.scale_steps)] - 12

                lead_freq = note_frequency(prompt_plan.root_frequency, note_step)
                bass_freq = note_frequency(prompt_plan.root_frequency, bass_step)

                lead = _oscillator(prompt_plan.waveform, lead_freq, t)
                pad = math.sin(2 * math.pi * (lead_freq / 2.0) * t)
                bass = _oscillator("triangle", bass_freq, t)

                pulse = 1.0 if (i % beat_samples) < beat_samples * 0.18 else 0.35
                env = min(1.0, (i + 1) / (fr * 0.4))
                tail = min(1.0, (nframes - i) / (fr * 0.6))
                val = (
                    lead * prompt_plan.energy * 0.45
                    + pad * prompt_plan.pad_mix * 0.25
                    + bass * 0.25
                ) * pulse * env * tail

                wf.writeframes(struct.pack("<h", int(max(-1.0, min(1.0, val)) * 32767)))

        return {
            "provider": "procedural",
            "model": "prompt-synth-v1",
            "duration_sec": duration_sec,
            "sample_rate": fr,
        }


class MusicGenProvider(MusicProvider):
    def __init__(self, model_id: str):
        self.model_id = model_id
        self._lock = threading.Lock()
        self._model = None
        self._processor = None
        self._torch = None

    def _ensure_loaded(self):
        if self._model is not None and self._processor is not None:
            return

        with self._lock:
            if self._model is not None and self._processor is not None:
                return

            try:
                import torch
                from transformers import AutoProcessor, MusicgenForConditionalGeneration

                token = settings.hf_token
                device = "cuda" if torch.cuda.is_available() else "cpu"

                self._processor = AutoProcessor.from_pretrained(
                    self.model_id,
                    cache_dir=MODEL_CACHE_DIR,
                    token=token,
                )
                self._model = MusicgenForConditionalGeneration.from_pretrained(
                    self.model_id,
                    cache_dir=MODEL_CACHE_DIR,
                    token=token,
                )
                self._model.to(device)
                self._model.eval()
                self._torch = torch
            except Exception as exc:
                raise RuntimeError(
                    f"Failed to load MusicGen model '{self.model_id}'. "
                    "Check internet access, available disk space, and HF_TOKEN if the model requires it."
                ) from exc

    def generate(self, prompt: str, duration_sec: int, output_path: str, prompt_plan) -> dict:
        self._ensure_loaded()
        torch = self._torch
        device = next(self._model.parameters()).device

        max_duration = min(30, max(1, duration_sec))
        max_new_tokens = max(64, min(1503, int(1503 * (max_duration / 30.0))))

        inputs = self._processor(
            text=[prompt],
            padding=True,
            return_tensors="pt",
        ).to(device)

        with torch.inference_mode():
            audio_values = self._model.generate(
                **inputs,
                do_sample=True,
                guidance_scale=3,
                max_new_tokens=max_new_tokens,
            )

        sampling_rate = self._model.config.audio_encoder.sampling_rate
        audio = audio_values[0, 0].detach().cpu().float().numpy()
        audio = audio.clip(-1.0, 1.0)

        from scipy.io.wavfile import write as write_wav

        write_wav(output_path, rate=sampling_rate, data=audio)
        return {
            "provider": "musicgen",
            "model": self.model_id,
            "duration_sec": max_duration,
            "sample_rate": sampling_rate,
            "device": str(device),
        }


class ProceduralImageProvider(ImageProvider):
    def generate(self, output_dir: str, prompt: str, scenes: list, prompt_plan) -> dict:
        image_paths = []
        for scene in scenes:
            image = _render_scene_frame(prompt_plan, scene)
            path = os.path.join(output_dir, f"cut_{scene.index:02d}.png")
            image.save(path)
            image_paths.append(path)

        return {
            "provider": "procedural",
            "model": "storyboard-renderer-v1",
            "image_paths": image_paths,
        }


class DiffusersImageProvider(ImageProvider):
    def __init__(self, model_id: str):
        self.model_id = model_id
        self._lock = threading.Lock()
        self._pipeline = None
        self._torch = None

    def _ensure_loaded(self):
        if self._pipeline is not None:
            return

        with self._lock:
            if self._pipeline is not None:
                return

            try:
                import torch
                from diffusers import StableDiffusionPipeline

                token = settings.hf_token
                device = "cuda" if torch.cuda.is_available() else "cpu"
                dtype = torch.float16 if device == "cuda" else torch.float32

                pipe = StableDiffusionPipeline.from_pretrained(
                    self.model_id,
                    torch_dtype=dtype,
                    cache_dir=MODEL_CACHE_DIR,
                    token=token,
                )
                pipe = pipe.to(device)
                pipe.enable_attention_slicing()

                self._pipeline = pipe
                self._torch = torch
            except Exception as exc:
                raise RuntimeError(
                    f"Failed to load diffusion model '{self.model_id}'. "
                    "Check internet access, available disk space, and HF_TOKEN if the model requires it."
                ) from exc

    def generate(self, output_dir: str, prompt: str, scenes: list, prompt_plan) -> dict:
        self._ensure_loaded()
        torch = self._torch
        device = self._pipeline.device
        negative_prompt = settings.image_negative_prompt

        image_paths = []
        for scene in scenes:
            seed = abs(hash((prompt, scene.index))) % (2**31)
            generator = torch.Generator(device=device.type).manual_seed(seed)
            result = self._pipeline(
                prompt=_build_diffusion_prompt(prompt, scene),
                negative_prompt=negative_prompt,
                num_inference_steps=30,
                guidance_scale=7.5,
                height=512,
                width=768,
                generator=generator,
            )

            image = ImageOps.fit(result.images[0].convert("RGB"), (1280, 720), method=Image.Resampling.LANCZOS)
            path = os.path.join(output_dir, f"cut_{scene.index:02d}.png")
            image.save(path)
            image_paths.append(path)

        return {
            "provider": "diffusers",
            "model": self.model_id,
            "image_paths": image_paths,
            "device": str(device),
        }


_music_provider = None
_image_provider = None
_provider_lock = threading.Lock()


def get_music_provider() -> MusicProvider:
    global _music_provider
    if _music_provider is not None:
        return _music_provider

    with _provider_lock:
        if _music_provider is not None:
            return _music_provider

        provider_name = settings.music_provider
        if provider_name == "procedural":
            _music_provider = ProceduralMusicProvider()
        else:
            model_id = settings.musicgen_model_id
            _music_provider = MusicGenProvider(model_id=model_id)
        return _music_provider


def get_image_provider() -> ImageProvider:
    global _image_provider
    if _image_provider is not None:
        return _image_provider

    with _provider_lock:
        if _image_provider is not None:
            return _image_provider

        provider_name = settings.image_provider
        if provider_name == "procedural":
            _image_provider = ProceduralImageProvider()
        else:
            model_id = settings.diffusion_model_id
            _image_provider = DiffusersImageProvider(model_id=model_id)
        return _image_provider


def get_provider_config() -> dict:
    return {
        "music_provider": settings.music_provider,
        "image_provider": settings.image_provider,
        "music_model": settings.musicgen_model_id,
        "image_model": settings.diffusion_model_id,
        "allow_provider_fallback": settings.allow_provider_fallback,
    }


def resolve_music_provider() -> MusicProvider:
    try:
        return get_music_provider()
    except Exception:
        if settings.allow_provider_fallback:
            return ProceduralMusicProvider()
        raise


def resolve_image_provider() -> ImageProvider:
    try:
        return get_image_provider()
    except Exception:
        if settings.allow_provider_fallback:
            return ProceduralImageProvider()
        raise


def _oscillator(kind: str, frequency: float, t: float) -> float:
    phase = 2 * math.pi * frequency * t
    if kind == "triangle":
        return (2 / math.pi) * math.asin(math.sin(phase))
    if kind == "saw":
        return 2.0 * ((frequency * t) % 1.0) - 1.0
    return math.sin(phase)


def _lerp_color(start: tuple[int, int, int], end: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    factor = max(0.0, min(1.0, factor))
    return tuple(int(a + (b - a) * factor) for a, b in zip(start, end))


def _render_scene_frame(prompt_plan, scene):
    width, height = 1280, 720
    base = Image.new("RGB", (width, height), prompt_plan.palette[0])
    draw = ImageDraw.Draw(base)

    for y in range(height):
        blend = y / max(1, height - 1)
        color = _lerp_color(prompt_plan.palette[0], prompt_plan.palette[1], blend)
        draw.line((0, y, width, y), fill=color)

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    _draw_motif(overlay_draw, width, height, prompt_plan, scene.index)
    _draw_titles(overlay_draw, prompt_plan, scene, width, height)

    merged = Image.alpha_composite(base.convert("RGBA"), overlay)
    merged = merged.filter(ImageFilter.GaussianBlur(radius=0.6))
    return _apply_grain(merged.convert("RGB"), prompt_plan.grain)


def _draw_motif(draw, width: int, height: int, prompt_plan, index: int):
    accent = prompt_plan.accent + (120,)

    if prompt_plan.motif == "waves":
        for offset in range(6):
            points = []
            band_y = int(height * (0.25 + offset * 0.1))
            for x in range(0, width + 40, 40):
                wave_offset = math.sin((x / width) * math.pi * 4 + index + offset) * 26
                points.append((x, band_y + wave_offset))
            draw.line(points, fill=accent, width=5)
        return

    if prompt_plan.motif == "grid":
        for x in range(0, width, 80):
            draw.line((x, 0, x, height), fill=accent, width=1)
        for y in range(0, height, 80):
            draw.line((0, y, width, y), fill=accent, width=1)
        return

    if prompt_plan.motif == "stars":
        for star in range(60):
            px = (star * 137 + index * 47) % width
            py = (star * 83 + index * 31) % height
            radius = 1 + ((star + index) % 3)
            draw.ellipse((px, py, px + radius * 2, py + radius * 2), fill=accent)
        return

    if prompt_plan.motif == "flowers":
        for flower in range(7):
            cx = int(width * (0.15 + flower * 0.12))
            cy = int(height * (0.55 + ((flower + index) % 3) * 0.08))
            for petal in range(6):
                angle = (math.pi * 2 / 6) * petal
                dx = math.cos(angle) * 30
                dy = math.sin(angle) * 30
                draw.ellipse((cx + dx - 18, cy + dy - 18, cx + dx + 18, cy + dy + 18), fill=accent)
            draw.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=(255, 240, 180, 180))
        return

    for ring in range(5):
        radius = 120 + ring * 75 + index * 8
        bbox = (width // 2 - radius, height // 2 - radius, width // 2 + radius, height // 2 + radius)
        draw.ellipse(bbox, outline=accent, width=5)


def _draw_titles(draw, prompt_plan, scene, width: int, height: int):
    panel = (28, 28, 36, 170)
    draw.rounded_rectangle((64, height - 170, 520, height - 48), radius=24, fill=panel)
    draw.text((92, height - 146), scene.title, fill=(245, 245, 245, 255))
    draw.text((92, height - 112), scene.camera, fill=(225, 225, 225, 255))
    draw.text((92, height - 82), scene.motion, fill=prompt_plan.accent + (255,))


def _apply_grain(image: Image.Image, intensity: int) -> Image.Image:
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            grain = ((x * 17 + y * 31) % (intensity * 2 + 1)) - intensity
            pixels[x, y] = (
                max(0, min(255, r + grain)),
                max(0, min(255, g + grain)),
                max(0, min(255, b + grain)),
            )
    return image


def _build_diffusion_prompt(prompt: str, scene) -> str:
    return (
        f"{prompt}, {scene.camera}, {scene.motion}, cinematic music video frame, "
        "high detail, dramatic lighting, cohesive color grading"
    )
