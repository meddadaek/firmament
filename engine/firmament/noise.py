import math
import random


class Noise2D:
    """Seeded 2D gradient (Perlin) noise, roughly in [-1, 1]. Pure Python, no numpy."""

    def __init__(self, seed: int):
        rng = random.Random(seed)
        perm = list(range(256))
        rng.shuffle(perm)
        self._perm = perm + perm
        self._grads = [(math.cos(a), math.sin(a)) for a in (rng.random() * math.tau for _ in range(256))]

    def _grad(self, ix: int, iy: int, dx: float, dy: float) -> float:
        gx, gy = self._grads[self._perm[(self._perm[ix & 255] + iy) & 255]]
        return gx * dx + gy * dy

    def __call__(self, x: float, y: float) -> float:
        xi, yi = math.floor(x), math.floor(y)
        xf, yf = x - xi, y - yi
        u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
        v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
        n00 = self._grad(xi, yi, xf, yf)
        n10 = self._grad(xi + 1, yi, xf - 1, yf)
        n01 = self._grad(xi, yi + 1, xf, yf - 1)
        n11 = self._grad(xi + 1, yi + 1, xf - 1, yf - 1)
        nx0 = n00 + u * (n10 - n00)
        nx1 = n01 + u * (n11 - n01)
        return (nx0 + v * (nx1 - nx0)) * 1.41
