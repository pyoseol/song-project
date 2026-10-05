from pathlib import Path
import tempfile
import os

import onnx
from onnx import TensorProto


MODEL = Path(
    "public/models/aqua-planet/dsmain/acoustic.onnx"
)


def dim_to_text(dim):
    if dim.HasField("dim_value"):
        return str(dim.dim_value)

    if dim.HasField("dim_param"):
        return dim.dim_param

    return "?"


def shape_to_text(value_info):
    tensor_type = value_info.type.tensor_type

    if not tensor_type.HasField("shape"):
        return "<unknown-rank>"

    return "[" + ", ".join(
        dim_to_text(dim)
        for dim in tensor_type.shape.dim
    ) + "]"


def clear_shape(value_info):
    tensor_type = value_info.type.tensor_type

    if tensor_type.HasField("shape"):
        tensor_type.ClearField("shape")


def main():
    if not MODEL.exists():
        raise FileNotFoundError(
            f"모델을 찾을 수 없습니다: {MODEL}"
        )

    print(f"[Aqua Planet] loading: {MODEL}")
    model = onnx.load(
        str(MODEL),
        load_external_data=True,
    )

    print(
        "[Aqua Planet] graph inputs:",
        len(model.graph.input),
    )

    print(
        "[Aqua Planet] graph outputs:",
        len(model.graph.output),
    )

    suspicious = []

    # 현재 model의 중간 value_info 확인
    for value_info in model.graph.value_info:
        shape = shape_to_text(value_info)

        if shape == "[1, 1, 256]":
            suspicious.append(value_info.name)

    print(
        "[Aqua Planet] intermediate [1,1,256] tensors:",
        len(suspicious),
    )

    for name in suspicious[:50]:
        print("  -", name)

    # 핵심 패치:
    # graph input/output은 건드리지 않고
    # intermediate value_info의 shape annotation만 제거한다.
    cleared = 0

    for value_info in model.graph.value_info:
        tensor_type = value_info.type.tensor_type

        if (
            tensor_type.elem_type
            != TensorProto.UNDEFINED
        ):
            if tensor_type.HasField("shape"):
                clear_shape(value_info)
                cleared += 1

    print(
        "[Aqua Planet] cleared intermediate shape annotations:",
        cleared,
    )

    # 임시 파일에 저장
    fd, temp_name = tempfile.mkstemp(
        suffix=".onnx",
        prefix="acoustic_patched_",
        dir=str(MODEL.parent),
    )

    os.close(fd)

    temp_path = Path(temp_name)

    try:
        print(
            "[Aqua Planet] saving temporary model:",
            temp_path,
        )

        onnx.save(
            model,
            str(temp_path),
        )

        # 저장된 모델 검사
        print(
            "[Aqua Planet] checking patched model..."
        )

        patched = onnx.load(
            str(temp_path),
            load_external_data=True,
        )

        onnx.checker.check_model(
            patched
        )

        print(
            "[Aqua Planet] ONNX check: OK"
        )

        # 원본을 교체
        os.replace(
            temp_path,
            MODEL,
        )

        print(
            "[Aqua Planet] acoustic.onnx patched successfully."
        )

    finally:
        if temp_path.exists():
            temp_path.unlink()


if __name__ == "__main__":
    main()