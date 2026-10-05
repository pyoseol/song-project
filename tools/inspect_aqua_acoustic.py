from pathlib import Path
import onnx


MODEL = Path(
    "public/models/aqua-planet/dsmain/acoustic.onnx"
)


def dim_text(dim):
    if dim.HasField("dim_value"):
        return str(dim.dim_value)

    if dim.HasField("dim_param"):
        return dim.dim_param

    return "?"


def value_shape(value_info):
    try:
        tensor_type = value_info.type.tensor_type

        if not tensor_type.HasField("shape"):
            return "?"

        dims = tensor_type.shape.dim

        return "[" + ",".join(
            dim_text(dim)
            for dim in dims
        ) + "]"
    except Exception:
        return "?"


def collect_shapes(model):
    shapes = {}

    for item in model.graph.input:
        shapes[item.name] = value_shape(item)

    for item in model.graph.output:
        shapes[item.name] = value_shape(item)

    for item in model.graph.value_info:
        shapes[item.name] = value_shape(item)

    return shapes


def main():
    if not MODEL.exists():
        raise FileNotFoundError(
            f"모델을 찾을 수 없습니다:\n{MODEL}"
        )

    print("=" * 80)
    print("Aqua Planet acoustic.onnx inspection")
    print("=" * 80)
    print("MODEL:", MODEL)
    print("SIZE :", MODEL.stat().st_size)
    print()

    model = onnx.load(
        str(MODEL),
        load_external_data=True,
    )

    shapes = collect_shapes(model)

    print("[MODEL]")
    print("ir_version     :", model.ir_version)
    print("producer_name  :", model.producer_name)
    print("producer_version:", model.producer_version)
    print("opset_import   :", [
        (
            item.domain,
            item.version,
        )
        for item in model.opset_import
    ])
    print()

    print("=" * 80)
    print("[GRAPH INPUTS]")
    print("=" * 80)

    for item in model.graph.input:
        print(
            item.name,
            "=>",
            shapes.get(item.name, "?"),
        )

    print()

    print("=" * 80)
    print("[NODES RELATED TO spk_embed]")
    print("=" * 80)

    found_spk = 0

    for index, node in enumerate(
        model.graph.node
    ):
        related = (
            any(
                "spk" in name.lower()
                for name in node.input
            )
            or any(
                "spk" in name.lower()
                for name in node.output
            )
        )

        if not related:
            continue

        found_spk += 1

        print()
        print(
            f"NODE #{index}"
        )
        print(
            "name:",
            node.name,
        )
        print(
            "op  :",
            node.op_type,
        )

        print("inputs:")

        for name in node.input:
            print(
                "  ",
                name,
                "=>",
                shapes.get(
                    name,
                    "<initializer/no shape>",
                ),
            )

        print("outputs:")

        for name in node.output:
            print(
                "  ",
                name,
                "=>",
                shapes.get(
                    name,
                    "<no shape>",
                ),
            )

    print()
    print(
        "spk_embed related nodes:",
        found_spk,
    )

    print()

    print("=" * 80)
    print(
        "[POTENTIAL 1,1,256 -> 1,51,256 NODES]"
    )
    print("=" * 80)

    found_mismatch = 0

    for index, node in enumerate(
        model.graph.node
    ):
        input_shapes = [
            shapes.get(name)
            for name in node.input
        ]

        output_shapes = [
            shapes.get(name)
            for name in node.output
        ]

        has_1_1_256 = (
            "[1,1,256]" in input_shapes
            or "[1,1,256]" in output_shapes
        )

        has_1_51_256 = (
            "[1,51,256]" in input_shapes
            or "[1,51,256]" in output_shapes
        )

        if not (
            has_1_1_256
            and has_1_51_256
        ):
            continue

        found_mismatch += 1

        print()
        print(
            f"NODE #{index}"
        )
        print(
            "name:",
            node.name,
        )
        print(
            "op  :",
            node.op_type,
        )

        print("inputs:")

        for name in node.input:
            print(
                "  ",
                name,
                "=>",
                shapes.get(
                    name,
                    "<initializer/no shape>",
                ),
            )

        print("outputs:")

        for name in node.output:
            print(
                "  ",
                name,
                "=>",
                shapes.get(
                    name,
                    "<no shape>",
                ),
            )

    print()

    print(
        "potential mismatch nodes:",
        found_mismatch,
    )

    print()
    print("=" * 80)
    print("[INITIALIZERS WITH 256 LAST DIMENSION]")
    print("=" * 80)

    for initializer in model.graph.initializer:
        dims = list(initializer.dims)

        if (
            len(dims) >= 1
            and dims[-1] == 256
        ):
            print(
                initializer.name,
                "=>",
                dims,
            )


if __name__ == "__main__":
    main()