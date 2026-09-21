"""The tech tree. Costs are paid from the stockpile when construction starts."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Blueprint:
    kind: str
    name: str
    cost: dict[str, int]
    work: float  # builder-seconds of labour
    beds: int = 0
    requires: tuple[str, ...] = ()
    summary: str = ""


BLUEPRINTS: dict[str, Blueprint] = {
    b.kind: b
    for b in (
        Blueprint("hut", "Hut", {"wood": 12, "stone": 4}, 40, beds=2, summary="Two beds. Sleeping indoors restores energy faster."),
        Blueprint("farm", "Farm", {"wood": 8}, 24, summary="Plant, wait, harvest: steady food without walking to berry bushes."),
        Blueprint("workshop", "Workshop", {"wood": 18, "stone": 14}, 60, requires=("hut",), summary="Lets the engineer craft tools that speed up all gathering."),
        Blueprint("house", "House", {"wood": 30, "stone": 22}, 90, beds=4, requires=("workshop",), summary="Four beds under a real roof."),
        Blueprint("townhall", "Town Hall", {"wood": 60, "stone": 50}, 180, requires=("house",), summary="The firm's headquarters. Founding it makes the camp a city."),
    )
}

# The order the (rule-based) architect follows. An LLM planner will choose its own later.
BUILD_ORDER: tuple[str, ...] = ("hut", "farm", "hut", "workshop", "hut", "house", "farm", "house", "townhall")


@dataclass
class Building:
    id: int
    kind: str
    tile: int
    state: str = "planned"  # planned (waiting for materials) → building → done
    work_done: float = 0.0
    crop: float = -1.0  # farms only: -1 empty, 0..1 growing, 1 ripe
    sleepers: list[str] = field(default_factory=list)

    @property
    def blueprint(self) -> Blueprint:
        return BLUEPRINTS[self.kind]

    @property
    def progress(self) -> float:
        return min(1.0, self.work_done / self.blueprint.work)
