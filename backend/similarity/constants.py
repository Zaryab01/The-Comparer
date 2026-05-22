import math

# Per-layer weights for the overall score.
# Base notes define a fragrance's identity most strongly.
LAYER_WEIGHTS: dict[str, float] = {
    "top": 0.25,
    "middle": 0.35,
    "base": 0.40,
}

LAYERS: tuple[str, ...] = ("top", "middle", "base")

DEFAULT_COMPARE_LIMIT = 3


def idf_weight(frequency: int) -> float:
    """Rare notes contribute more. Returns 1 / log(1 + frequency)."""
    return 1.0 / math.log(1 + max(frequency, 1))
