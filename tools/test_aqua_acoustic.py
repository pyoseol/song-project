from pathlib import Path

import numpy as np
import onnxruntime as ort


ROOT = Path("public/models/aqua-planet")

ACOUSTIC = ROOT / "dsmain/acoustic.onnx"
EMBED = ROOT / "dsmain/embeds/acoustic/base.emb"


def main():
    print("=" * 80)
    print("Aqua Planet acoustic.onnx direct test")
    print("=" * 80)

    print("model:", ACOUSTIC)
    print("size :", ACOUSTIC.stat().st_size)

    speaker_embedding = np.fromfile(
        EMBED,
        dtype=np.float32,
    )

    print(
        "speaker embedding:",
        speaker_embedding.shape,
    )

    if speaker_embedding.size != 256:
        raise RuntimeError(
            f"speaker embedding 크기 오류: {speaker_embedding.size}"
        )

    session = ort.InferenceSession(
        str(ACOUSTIC),
        providers=["CPUExecutionProvider"],
    )

    print()
    print("[INPUT METADATA]")

    for meta in session.get_inputs():
        print(
            meta.name,
            "type=", meta.type,
            "shape=", meta.shape,
        )

    total_frames = 51
    n_tokens = 1

    # 현재 브라우저에서 넣고 있는 것과 동일한 shape
    inputs = {
        "tokens": np.array(
            [[2]],
            dtype=np.int64,
        ),

        "languages": np.array(
            [[0]],
            dtype=np.int64,
        ),

        "durations": np.array(
            [[51]],
            dtype=np.int64,
        ),

        "f0": np.full(
            (1, total_frames),
            440.0,
            dtype=np.float32,
        ),

        "tension": np.zeros(
            (1, total_frames),
            dtype=np.float32,
        ),

        "gender": np.zeros(
            (1, total_frames),
            dtype=np.float32,
        ),

        "velocity": np.ones(
            (1, total_frames),
            dtype=np.float32,
        ),

        "spk_embed": np.tile(
            speaker_embedding.reshape(
                1,
                1,
                256,
            ),
            (
                1,
                total_frames,
                1,
            ),
        ),

        "depth": np.array(
            1.0,
            dtype=np.float32,
        ),

        "steps": np.array(
            50,
            dtype=np.int64,
        ),
    }

    print()
    print("[INPUT SHAPES]")

    for name, value in inputs.items():
        print(
            name,
            value.shape,
            value.dtype,
        )

    print()
    print("[RUN]")

    try:
        outputs = session.run(
            None,
            inputs,
        )

        print()
        print("SUCCESS")
        print(
            "output count:",
            len(outputs),
        )

        for index, output in enumerate(outputs):
            print(
                index,
                type(output),
                getattr(output, "shape", None),
            )

    except Exception as error:
        print()
        print("=" * 80)
        print("ACOUSTIC INFERENCE FAILED")
        print("=" * 80)
        print(error)

        raise


if __name__ == "__main__":
    main()