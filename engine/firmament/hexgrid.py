"""Pointy-top axial hex grid on the XZ plane (matches the frontend's src/world/hex.ts)."""

import math

SQRT3 = math.sqrt(3)
STEP = SQRT3  # distance between neighbouring tile centres

DIRECTIONS = ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1))


def to_world(q: int, r: int) -> tuple[float, float]:
    return SQRT3 * (q + r / 2), 1.5 * r


def hex_distance(aq: int, ar: int, bq: int = 0, br: int = 0) -> int:
    dq, dr = aq - bq, ar - br
    return max(abs(dq), abs(dr), abs(dq + dr))


def within(q: int, r: int, radius: int):
    """Every (q, r) within `radius` steps of (q, r), including itself."""
    for dq in range(-radius, radius + 1):
        for dr in range(max(-radius, -dq - radius), min(radius, -dq + radius) + 1):
            yield q + dq, r + dr
