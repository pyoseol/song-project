import math
import random
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class MusicPlan:
    bpm: int
    root_frequency: float
    scale_steps: tuple[int, ...]
    waveform: str
    energy: float
    pad_mix: float


@dataclass(frozen=True)
class VisualPlan:
    palette: tuple[tuple[int, int, int], ...]
    accent: tuple[int, int, int]
    mood: str
    motif: str
    grain: int


@dataclass(frozen=True)
class ScenePlan:
    index: int
    title: str
    prompt: str
    camera: str
    motion: str


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z]+", text.lower())


def _score_keywords(tokens: list[str], keywords: dict[str, tuple[str, ...]]) -> dict[str, int]:
    scores: dict[str, int] = {}
    for label, words in keywords.items():
        scores[label] = sum(tokens.count(word) for word in words)
    return scores


def _pick_weighted(scores: dict[str, int], default: str) -> str:
    best_label = default
    best_score = 0
    for label, score in scores.items():
        if score > best_score:
            best_label = label
            best_score = score
    return best_label


def analyze_music_prompt(prompt: str) -> MusicPlan:
    tokens = _tokenize(prompt)
    lowered = prompt.lower()
    seed = sum(ord(ch) for ch in lowered) or 1
    rng = random.Random(seed)

    mood_scores = _score_keywords(
        tokens,
        {
            "calm": ("ambient", "dreamy", "soft", "calm", "gentle", "peaceful"),
            "dark": ("dark", "night", "noir", "tense", "shadow", "ominous"),
            "uplift": ("bright", "happy", "uplifting", "summer", "hope", "joy"),
            "drive": ("action", "fast", "energetic", "power", "epic", "dance"),
        },
    )
    mood = _pick_weighted(mood_scores, "calm")

    genre_scores = _score_keywords(
        tokens,
        {
            "electronic": ("edm", "electronic", "synth", "house", "techno"),
            "cinematic": ("cinematic", "orchestra", "epic", "trailer", "score"),
            "lofi": ("lofi", "chill", "study", "jazzy"),
            "rock": ("rock", "guitar", "band", "punk", "indie"),
        },
    )
    genre = _pick_weighted(genre_scores, "electronic")

    bpm_map = {
        "calm": rng.randint(72, 92),
        "dark": rng.randint(88, 108),
        "uplift": rng.randint(100, 124),
        "drive": rng.randint(118, 144),
    }
    waveform_map = {
        "electronic": "sine",
        "cinematic": "triangle",
        "lofi": "sine",
        "rock": "saw",
    }
    scale_map = {
        "calm": (0, 3, 5, 7, 10),
        "dark": (0, 1, 3, 7, 8),
        "uplift": (0, 2, 4, 7, 9),
        "drive": (0, 2, 3, 7, 10),
    }

    return MusicPlan(
        bpm=bpm_map[mood],
        root_frequency=rng.choice((146.83, 164.81, 174.61, 196.00, 220.00, 246.94)),
        scale_steps=scale_map[mood],
        waveform="triangle" if "piano" in tokens else waveform_map[genre],
        energy={"calm": 0.35, "dark": 0.5, "uplift": 0.7, "drive": 0.9}[mood],
        pad_mix={"calm": 0.75, "dark": 0.55, "uplift": 0.45, "drive": 0.25}[mood],
    )


def analyze_visual_prompt(prompt: str) -> VisualPlan:
    tokens = _tokenize(prompt)

    palette_by_mood = {
        "sunset": ((255, 120, 70), (255, 200, 120), (120, 60, 160)),
        "neon": ((18, 12, 48), (45, 212, 191), (244, 91, 105)),
        "nature": ((38, 70, 83), (82, 183, 136), (233, 196, 106)),
        "mono": ((18, 18, 18), (110, 110, 110), (235, 235, 235)),
    }
    mood_scores = _score_keywords(
        tokens,
        {
            "sunset": ("sunset", "warm", "golden", "romance", "nostalgia"),
            "neon": ("neon", "cyberpunk", "city", "night", "club"),
            "nature": ("forest", "nature", "ocean", "sky", "mountain"),
            "mono": ("minimal", "monochrome", "black", "white", "noir"),
        },
    )
    mood = _pick_weighted(mood_scores, "sunset")

    if "rain" in tokens:
        accent = (120, 180, 255)
    elif "fire" in tokens:
        accent = (255, 90, 20)
    elif "love" in tokens:
        accent = (255, 80, 140)
    else:
        accent = palette_by_mood[mood][-1]

    motif = "circle"
    for candidate in ("city", "stars", "waves", "flowers", "grid"):
        if candidate in tokens:
            motif = candidate
            break

    grain = 18 if "vintage" in tokens or "film" in tokens else 8

    return VisualPlan(
        palette=palette_by_mood[mood],
        accent=accent,
        mood=mood,
        motif=motif,
        grain=grain,
    )


def build_scene_plan(prompt: str, num_images: int) -> list[ScenePlan]:
    tokens = _tokenize(prompt)
    subject = next((token for token in tokens if len(token) > 4), "dreamscape")
    cameras = ("wide shot", "tracking shot", "close-up", "aerial shot", "silhouette shot")
    motions = ("slow drift", "pulse zoom", "parallax slide", "spiral reveal", "soft shake")

    scenes = []
    for index in range(num_images):
        phase = index + 1
        scenes.append(
            ScenePlan(
                index=index,
                title=f"Scene {phase:02d}",
                prompt=f"{subject} sequence phase {phase}, {prompt.strip()}",
                camera=cameras[index % len(cameras)],
                motion=motions[index % len(motions)],
            )
        )
    return scenes


def note_frequency(root_frequency: float, semitone_offset: int) -> float:
    return root_frequency * math.pow(2.0, semitone_offset / 12.0)
