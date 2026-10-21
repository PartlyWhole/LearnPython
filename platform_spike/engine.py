"""Grid-world engine: world rules, the learner-facing API, run isolation and level checking.

Pure Python and stdlib only. The same file runs under desktop CPython (tests, grading) and in
Pyodide inside a Web Worker (the app). Never import browser modules (`js`, `pyodide`) here:
see docs/decisions.md D2. Data formats are defined in schemas/ and must stay in sync with
validate_world / validate_level / run_program below.
"""
import ast
import contextlib
import hashlib
import io
import json
import random
import sys

FORMAT_VERSION = 1
STUDENT_FILE = "<student>"
DIRS = ["E", "N", "W", "S"]
DELTA = {"E": (1, 0), "N": (0, -1), "W": (-1, 0), "S": (0, 1)}
API_NAMES = ("move", "turn_left", "front_is_clear", "pick", "put", "gems_here", "scan", "coin_flip")
DRIVE_COMMANDS = ("move", "turn_left", "pick", "put")  # drive-mode buttons: actions, not sensors
DEFAULT_MAX_STEPS = 10_000
INFINITE = "infinite"

# Constructs a level may ban or require, mapped to the ast nodes that implement them (teaching
# aid only, not a security boundary: see docs/decisions.md D7).
CONSTRUCTS = {
    "for": (ast.For,),
    "while": (ast.While,),
    "if": (ast.If,),
    "def": (ast.FunctionDef,),
    "lambda": (ast.Lambda,),
    "import": (ast.Import, ast.ImportFrom),
    "comprehension": (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp),
    "compare": (ast.Compare,),   # >, <, ==, != ... (L6.3: so a twist can't dodge the comparison)
    "return": (ast.Return,),     # a function that answers (L6.4: bool helpers)
}
# How constraint messages name a construct to a learner (default: the keyword itself).
CONSTRUCT_WORDS = {"compare": "a comparison such as > or ==", "return": "a function that uses return"}
BANNABLE = CONSTRUCTS  # backwards-compatible name

GOAL_KEYS = {"all_gems_collected", "end_at", "facing", "bag_at_least", "gems_exactly", "no_error"}
WORLD_KEYS = {"width", "height", "start", "blocked", "gems", "bag", "max_steps", "name", "goal"}


class WorldError(Exception):
    """An error the learner caused in the world. `kind` tells the renderer what to mark."""

    KINDS = ("wall", "no_gem", "empty_bag", "step_limit", "unavailable")

    def __init__(self, message, kind):
        super().__init__(message)
        assert kind in self.KINDS, kind
        self.kind = kind


class LevelError(ValueError):
    """A level or world file does not match the format (an authoring error, not a learner error)."""


# ---------------------------------------------------------------------------
# Validation (mirrors schemas/level.schema.json; the contract tests keep them in sync)
# ---------------------------------------------------------------------------

def _cell(v, path, w, h):
    if not (isinstance(v, list) and len(v) == 2 and all(isinstance(n, int) for n in v)):
        raise LevelError(f"{path}: expected [x, y] integers, got {v!r}")
    if not (0 <= v[0] < w and 0 <= v[1] < h):
        raise LevelError(f"{path}: cell {v} is outside the {w}x{h} grid")


def _gem_map(gems, path, w, h):
    if not isinstance(gems, dict):
        raise LevelError(f"{path}: expected an object of 'x,y': count")
    for key, n in gems.items():
        try:
            cell = [int(p) for p in key.split(",")]
        except ValueError:
            raise LevelError(f"{path}: key {key!r} must look like 'x,y'") from None
        _cell(cell, f"{path}[{key!r}]", w, h)
        if not (isinstance(n, int) and not isinstance(n, bool) and n >= 1):
            raise LevelError(f"{path}[{key!r}]: count must be a positive integer")


def validate_goal(goal, path, w=50, h=50, partial=False):
    if not isinstance(goal, dict) or (not goal and not partial) or set(goal) - GOAL_KEYS:
        raise LevelError(f"{path}: use one or more of {sorted(GOAL_KEYS)}")
    if "end_at" in goal:
        _cell(goal["end_at"], f"{path}.end_at", w, h)
    if "facing" in goal and goal["facing"] not in DIRS:
        raise LevelError(f"{path}.facing: must be one of {DIRS}")
    if "gems_exactly" in goal:
        _gem_map(goal["gems_exactly"], f"{path}.gems_exactly", w, h)
    if "bag_at_least" in goal and not (isinstance(goal["bag_at_least"], int) and goal["bag_at_least"] >= 0):
        raise LevelError(f"{path}.bag_at_least: must be a non-negative integer")
    for flag in ("all_gems_collected", "no_error"):
        if flag in goal and not isinstance(goal[flag], bool):
            raise LevelError(f"{path}.{flag}: must be true or false")


def validate_world(spec, path="world"):
    if not isinstance(spec, dict):
        raise LevelError(f"{path}: expected an object")
    for key in ("width", "height", "start"):
        if key not in spec:
            raise LevelError(f"{path}: missing '{key}'")
    w, h = spec["width"], spec["height"]
    if not (isinstance(w, int) and isinstance(h, int) and 1 <= w <= 50 and 1 <= h <= 50):
        raise LevelError(f"{path}: width and height must be integers from 1 to 50")
    start = spec["start"]
    if not (isinstance(start, list) and len(start) == 3 and start[2] in DIRS):
        raise LevelError(f"{path}.start: expected [x, y, direction] with direction in {DIRS}")
    _cell(start[:2], f"{path}.start", w, h)
    for i, c in enumerate(spec.get("blocked", [])):
        _cell(c, f"{path}.blocked[{i}]", w, h)
        if c == start[:2]:
            raise LevelError(f"{path}.blocked[{i}]: the start cell cannot be blocked")
    _gem_map(spec.get("gems", {}), f"{path}.gems", w, h)
    bag = spec.get("bag", 0)
    if not (bag == INFINITE or (isinstance(bag, int) and not isinstance(bag, bool) and 0 <= bag <= 10_000)):
        raise LevelError(f"{path}.bag: must be an integer from 0 to 10000, or \"{INFINITE}\"")
    ms = spec.get("max_steps", DEFAULT_MAX_STEPS)
    if not (isinstance(ms, int) and 1 <= ms <= 1_000_000):
        raise LevelError(f"{path}.max_steps: must be an integer from 1 to 1000000")
    if "goal" in spec:
        validate_goal(spec["goal"], f"{path}.goal", w, h, partial=True)
    unknown = set(spec) - WORLD_KEYS
    if unknown:
        raise LevelError(f"{path}: unknown keys {sorted(unknown)}")


def validate_level(level):
    if not isinstance(level, dict):
        raise LevelError("level: expected an object")
    if level.get("format") != FORMAT_VERSION:
        raise LevelError(f"level.format: expected {FORMAT_VERSION}")
    for key in ("id", "title", "world", "goal"):
        if key not in level:
            raise LevelError(f"level: missing '{key}'")
    validate_world(level["world"], "level.world")
    for i, wspec in enumerate(level.get("hidden_worlds", [])):
        validate_world(wspec, f"level.hidden_worlds[{i}]")
    validate_goal(level["goal"], "level.goal")
    c = level.get("constraints", {})
    for key in ("banned", "required"):
        if set(c.get(key, [])) - set(CONSTRUCTS):
            raise LevelError(f"level.constraints.{key}: choose from {sorted(CONSTRUCTS)}")
    if set(c.get("hidden_commands", [])) - set(API_NAMES):
        raise LevelError(f"level.constraints.hidden_commands: choose from {list(API_NAMES)}")
    if "drive" in level:
        buttons = level["drive"].get("buttons") if isinstance(level["drive"], dict) else None
        if not buttons or set(buttons) - set(DRIVE_COMMANDS) or len(set(buttons)) != len(buttons):
            raise LevelError(f"level.drive.buttons: one or more of {list(DRIVE_COMMANDS)}, no repeats")


def goal_for(level, world_spec):
    """The goal that applies to one world: the level goal, overridden by the world's own goal."""
    return {**level["goal"], **world_spec.get("goal", {})}


# ---------------------------------------------------------------------------
# World and learner API
# ---------------------------------------------------------------------------

class World:
    def __init__(self, spec, seed=0, hidden_commands=()):
        validate_world(spec)
        self.w, self.h = spec["width"], spec["height"]
        self.blocked = {tuple(c) for c in spec.get("blocked", [])}
        self.gems = {tuple(map(int, k.split(","))): v for k, v in spec.get("gems", {}).items()}
        self.x, self.y, self.dir = spec["start"]
        bag = spec.get("bag", 0)
        self.infinite_bag = bag == INFINITE
        self.bag = 0 if self.infinite_bag else bag
        self.rng = random.Random(seed)
        self.max_steps = spec.get("max_steps", DEFAULT_MAX_STEPS)
        self.hidden_commands = set(hidden_commands)
        self.trace = []

    def _student_lines(self):
        """The learner's line making this call, and the lines of the calls it is inside
        (outermost first): in `turn_right()` called from line 6, line 2's move has calls [6]."""
        f = sys._getframe(1)
        lines = []
        while f is not None:
            if f.f_code.co_filename == STUDENT_FILE:
                lines.append(f.f_lineno)
            f = f.f_back
        return (lines[0] if lines else None), lines[:0:-1]

    def _spend_step(self):
        """Call FIRST in every API method, before any state changes: if the step cap is hit,
        nothing may change without a matching trace event, or replays would disagree with the
        engine's final state (caught by tests/js/frames.test.mjs)."""
        if len(self.trace) >= self.max_steps:
            raise WorldError(f"Your program took more than {self.max_steps} steps. Is a loop running forever?",
                             "step_limit")

    def _record(self, action, **extra):
        line, calls = self._student_lines()
        event = {"line": line, "action": action, "x": self.x, "y": self.y, "dir": self.dir, "bag": self.bag, **extra}
        if calls:
            event["calls"] = calls
        self.trace.append(event)

    def front_is_clear(self):
        self._spend_step()
        dx, dy = DELTA[self.dir]
        nx, ny = self.x + dx, self.y + dy
        ok = 0 <= nx < self.w and 0 <= ny < self.h and (nx, ny) not in self.blocked
        self._record("front_is_clear", result=ok)
        return ok

    def move(self):
        self._spend_step()
        dx, dy = DELTA[self.dir]
        nx, ny = self.x + dx, self.y + dy
        if not (0 <= nx < self.w and 0 <= ny < self.h) or (nx, ny) in self.blocked:
            raise WorldError("There's a wall in front of you.", "wall")
        self.x, self.y = nx, ny
        self._record("move")

    def turn_left(self):
        self._spend_step()
        self.dir = DIRS[(DIRS.index(self.dir) + 1) % 4]
        self._record("turn_left")

    def pick(self):
        self._spend_step()
        if self.gems.get((self.x, self.y), 0) == 0:
            raise WorldError("There's no gem here.", "no_gem")
        self.gems[(self.x, self.y)] -= 1
        if self.gems[(self.x, self.y)] == 0:
            del self.gems[(self.x, self.y)]
        self.bag += 1
        self._record("pick")

    def put(self):
        """Place one gem from the bag on this cell (an infinite bag never runs out)."""
        self._spend_step()
        if not self.infinite_bag:
            if self.bag == 0:
                raise WorldError("Your bag is empty, so there's no gem to put down.", "empty_bag")
            self.bag -= 1
        self.gems[(self.x, self.y)] = self.gems.get((self.x, self.y), 0) + 1
        self._record("put")

    def gems_here(self):
        self._spend_step()
        n = self.gems.get((self.x, self.y), 0)
        self._record("gems_here", result=n)
        return n

    def scan(self):
        """Data-returning sensor: list of gem counts in the cells ahead, up to the wall."""
        self._spend_step()
        dx, dy = DELTA[self.dir]
        out, cx, cy = [], self.x + dx, self.y + dy
        while 0 <= cx < self.w and 0 <= cy < self.h and (cx, cy) not in self.blocked:
            out.append(self.gems.get((cx, cy), 0))
            cx, cy = cx + dx, cy + dy
        self._record("scan", result=out)
        return out

    def coin_flip(self):
        self._spend_step()
        r = self.rng.random() < 0.5
        self._record("coin_flip", result=r)
        return r

    def api(self):
        """The learner's namespace: real commands, plus stubs for commands this level hides."""
        def unavailable(name):
            def stub(*_args, **_kwargs):
                raise WorldError(f"{name}() isn't available in this level. Solve it without it!", "unavailable")
            return stub
        return {n: unavailable(n) if n in self.hidden_commands else getattr(self, n) for n in API_NAMES}

    def gem_map(self):
        return {f"{x},{y}": n for (x, y), n in sorted(self.gems.items()) if n > 0}


# ---------------------------------------------------------------------------
# Running and checking
# ---------------------------------------------------------------------------

def run_program(code, spec, seed=0, hidden_commands=()):
    """Run learner code against one world. Never raises; every learner error becomes data.

    Each call gets a fresh World and a fresh namespace, and captures print() output, so a
    reused (warm) interpreter cannot leak state between runs (docs/decisions.md D4).
    Returns a dict matching schemas/run_result.schema.json.
    """
    world = World(spec, seed, hidden_commands)
    namespace = {"__name__": "__main__", **world.api()}
    error = None
    printed = io.StringIO()
    try:
        with contextlib.redirect_stdout(printed):
            exec(compile(code, STUDENT_FILE, "exec"), namespace)
    except SyntaxError as e:
        error = {"type": "SyntaxError", "message": e.msg, "line": e.lineno}
    except Exception as e:  # noqa: BLE001
        tb, line = e.__traceback__, None
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == STUDENT_FILE:
                line = tb.tb_lineno
            tb = tb.tb_next
        error = {"type": type(e).__name__, "message": str(e), "line": line}
        if isinstance(e, WorldError):
            error["kind"] = e.kind
    gems = world.gem_map()
    return {"format": FORMAT_VERSION, "trace": world.trace, "error": error, "output": printed.getvalue(),
            "final": {"x": world.x, "y": world.y, "dir": world.dir, "bag": world.bag,
                      "gems_left": sum(gems.values()), "gems": gems}}


def _describe_layout_difference(actual, expected):
    missing = [k for k in expected if actual.get(k, 0) < expected[k]]
    extra = [k for k in actual if actual[k] > expected.get(k, 0)]
    parts = []
    if missing:
        parts.append(f"cells needing more gems: {', '.join('(' + k + ')' for k in missing[:4])}")
    if extra:
        parts.append(f"cells with too many: {', '.join('(' + k + ')' for k in extra[:4])}")
    return "The gems aren't in the right places (" + "; ".join(parts) + ")."


def _goal_failures(result, goal):
    out, f = [], result["final"]
    if goal.get("no_error", True) and result["error"]:
        # A crash explains everything after it; listing its knock-on effects is noise (D14).
        return [f"Stopped on line {result['error']['line']}: {result['error']['message']}"]
    if goal.get("all_gems_collected") and f["gems_left"]:
        out.append(f"{f['gems_left']} gem(s) were left behind.")
    if "gems_exactly" in goal and f["gems"] != goal["gems_exactly"]:
        out.append(_describe_layout_difference(f["gems"], goal["gems_exactly"]))
    if "end_at" in goal and [f["x"], f["y"]] != goal["end_at"]:
        out.append(f"The robot should finish at {goal['end_at']}, not [{f['x']}, {f['y']}].")
    if "facing" in goal and f["dir"] != goal["facing"]:
        names = {"E": "east", "N": "north", "W": "west", "S": "south"}
        out.append(f"The robot should finish facing {names[goal['facing']]}, not {names[f['dir']]}.")
    if "bag_at_least" in goal and f["bag"] < goal["bag_at_least"]:
        out.append(f"The bag should hold at least {goal['bag_at_least']} gem(s), not {f['bag']}.")
    return out


def count_lines(code):
    """Lines that count toward max_lines: not blank, not only a comment (src/ui/lines.js agrees)."""
    return sum(1 for ln in code.splitlines() if ln.strip() and not ln.strip().startswith("#"))


def line_goal(code, constraints):
    """The line-count bonus: {max, used, met}, or None if the level has no line limit."""
    if "max_lines" not in constraints:
        return None
    used = count_lines(code)
    return {"max": constraints["max_lines"], "used": used, "met": used <= constraints["max_lines"]}


def check_constraints(code, constraints):
    """Teaching constraints (banned or required constructs). Not a security boundary.
    The line limit is not one of them: it is a bonus (`line_goal`), never a reason to fail."""
    out = []
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return out  # run_program reports the syntax error
    used = {name for name, nodes in CONSTRUCTS.items()
            if any(isinstance(node, nodes) for node in ast.walk(tree))}
    for name in constraints.get("banned", []):
        if name in used:
            out.append(f"This level asks you not to use {CONSTRUCT_WORDS.get(name, repr(name))}.")
    for name in constraints.get("required", []):
        if name not in used:
            out.append(f"This level asks you to use {CONSTRUCT_WORDS.get(name, repr(name))}.")
    return out


# ---------------------------------------------------------------------------
# Guided steps (lesson "done_when" checks, docs/lessons.md section 5.3)
# ---------------------------------------------------------------------------

_STEP_KINDS = {"for": ast.For, "while": ast.While, "if": ast.If, "def": ast.FunctionDef}


def _context(node):
    """The name a statement gives to the code nested in it: for, while, if, or 'def <name>'."""
    if isinstance(node, ast.FunctionDef):
        return "def " + node.name
    return {ast.For: "for", ast.While: "while", ast.If: "if"}.get(type(node))


def _statements(tree):
    """Every statement with the stack of constructs whose *body* contains it, outermost first.
    A loop's or if's own condition belongs to the enclosing stack, not to the construct."""
    out = []

    def walk(node, stack):
        for field in ("body", "orelse"):
            for child in getattr(node, field, None) or []:
                out.append((child, stack))
                ctx = _context(child)
                walk(child, stack + [ctx] if ctx else stack)
    walk(tree, [])
    return out


def _own_calls(stmt):
    """Names called in a statement itself, not in the statements nested inside it."""
    names = []
    for field, value in ast.iter_fields(stmt):
        if field in ("body", "orelse"):
            continue
        for item in value if isinstance(value, list) else [value]:
            if isinstance(item, ast.AST):
                names += [n.func.id for n in ast.walk(item)
                          if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)]
    return names


def _in_path(stack, path):
    """'while>if' matches any stack holding a while and, deeper, an if (gaps allowed).
    'def' matches any function; 'def <name>' only that one."""
    want = path.split(">")
    i = 0
    for ctx in stack:
        if i < len(want) and (ctx == want[i] or (want[i] == "def" and ctx.startswith("def "))):
            i += 1
    return i == len(want)


def _has_else(node):
    return bool(getattr(node, "orelse", None)) and not (
        isinstance(node, ast.If) and len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If))


def _check_one(tree, code, check, run):
    if "not" in check:
        return not _check_one(tree, code, check["not"], run)
    if "run" in check or "robot_at" in check:
        # A run result only counts for the exact code it ran: any edit makes it stale.
        if not run or run.get("code") != code:
            return False
        if "robot_at" in check:
            return list(run.get("end") or []) == list(check["robot_at"])
        want = check["run"]
        return want == "any" or (want == "no_error" and not run.get("error")) or (
            want == "passed" and bool(run.get("passed")))
    if tree is None:
        return False
    stmts = _statements(tree)
    lo, hi = check.get("min", 1), check.get("max", float("inf"))
    if "has" in check:
        kind = check["has"]
        hits = [(n, st) for n, st in stmts
                if (_has_else(n) if kind == "else" else isinstance(n, _STEP_KINDS[kind]))]
        if "range" in check:
            hits = [(n, st) for n, st in hits if isinstance(n, ast.For) and isinstance(n.iter, ast.Call)
                    and isinstance(n.iter.func, ast.Name) and n.iter.func.id == "range"
                    and len(n.iter.args) == 1 and isinstance(n.iter.args[0], ast.Constant)
                    and n.iter.args[0].value == check["range"]]
        if "inside" in check:
            hits = [(n, st) for n, st in hits if _in_path(st, check["inside"])]
        return lo <= len(hits) <= hi
    if "defines" in check or "docstring" in check:
        name = check.get("defines", check.get("docstring"))
        defs = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name]
        if not defs:
            return False
        if "docstring" in check and not ast.get_docstring(defs[0]):
            return False
        for callee, count in check.get("body_calls", {}).items():
            got = sum(1 for n in ast.walk(defs[0]) if isinstance(n, ast.Call)
                      and isinstance(n.func, ast.Name) and n.func.id == callee)
            if got != count:
                return False
        return True
    if "calls" in check:
        n = 0
        for stmt, stack in stmts:
            for name in _own_calls(stmt):
                if name != check["calls"]:
                    continue
                if "inside" in check and not _in_path(stack, check["inside"]):
                    continue
                out = check.get("outside")
                if out and any(ctx == out or (out == "def" and ctx.startswith("def ")) for ctx in stack):
                    continue
                n += 1
        return lo <= n <= hi
    raise ValueError(f"unknown check {check}")


def check_code(code, checks, run=None):
    """Evaluate lesson checks against the learner's code (and their last run, if any).

    run: {"code", "passed", "error", "end": [x, y]} from the page's last run of this level, or None.
    Returns one bool per check. Code that doesn't parse fails every code check.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError:
        tree = None
    return [_check_one(tree, code, c, run) for c in checks]


def guide_state(code, steps, run=None):
    """For the guide panel: {"syntax_ok", "steps": [bool per step: all its checks hold]}."""
    try:
        ast.parse(code)
        syntax_ok = True
    except SyntaxError:
        syntax_ok = False
    return {"syntax_ok": syntax_ok, "steps": [all(check_code(code, s, run)) for s in steps]}


def check_level(code, level, seed=0):
    """Run code on the level's world and every hidden world; report pass/fail with reasons."""
    validate_level(level)
    hidden = level.get("constraints", {}).get("hidden_commands", [])
    worlds = [("main", level["world"])] + [
        (w.get("name", f"hidden {i + 1}"), w) for i, w in enumerate(level.get("hidden_worlds", []))]
    reports = []
    for name, spec in worlds:
        result = run_program(code, spec, seed, hidden)
        failures = _goal_failures(result, goal_for(level, spec))
        reports.append({"world": name, "passed": not failures, "failures": failures,
                        "result": result if name == "main" else None})
    constraint_failures = check_constraints(code, level.get("constraints", {}))
    return {"passed": all(r["passed"] for r in reports) and not constraint_failures,
            "worlds": reports, "constraint_failures": constraint_failures,
            "lines": line_goal(code, level.get("constraints", {}))}


def trace_digest(result):
    """Stable short hash of a run result: the cross-runtime contract compares these."""
    return hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()[:16]
