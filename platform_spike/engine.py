"""Grid-world engine: world rules, the learner-facing API, run isolation and level checking.

Pure Python and stdlib only. The same file runs under desktop CPython (tests, grading) and in
Pyodide inside a Web Worker (the app). Never import browser modules (`js`, `pyodide`) here:
see docs/decisions.md D2. Data formats are defined in schemas/ and must stay in sync with
validate_world / validate_level / run_program below.
"""
import ast
import collections
import contextlib
import difflib
import hashlib
import io
import json
import random
import re
import sys

FORMAT_VERSION = 1
STUDENT_FILE = "<student>"
DIRS = ["E", "N", "W", "S"]
DELTA = {"E": (1, 0), "N": (0, -1), "W": (-1, 0), "S": (0, 1)}
API_NAMES = ("move", "turn_left", "front_is_clear", "pick", "put", "gems_here", "scan", "coin_flip")
DRIVE_COMMANDS = ("move", "turn_left", "pick", "put")
SENSOR_NAMES = ("front_is_clear", "gems_here", "scan", "coin_flip")  # drive-mode buttons: actions, not sensors
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
CONSTRUCT_WORDS = {"compare": "a comparison such as > or ==", "return": "a function that uses return",
                   "for": "a for loop", "while": "a while loop", "if": "an if", "def": "a function of your own (def)",
                   "lambda": "lambda", "import": "import", "comprehension": "a list comprehension"}
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
    for key in ("use_functions", "loop_calls"):
        if not all(isinstance(n, str) and n.isidentifier() for n in c.get(key, [])):
            raise LevelError(f"level.constraints.{key}: function names")
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
        self.printed = None  # run_program's print() capture, so each event can say how far it got
        self._call_ids = {}  # id(frame) -> (call number, frame): see _student_lines

    def _student_lines(self):
        """The learner's line making this call, the lines of the calls it is inside (outermost
        first: in `turn_right()` called from line 6, line 2's move has calls [6]), and which call
        each one is (1, 2, ... in the order calls first made a step), so two calls in a row from
        one line can be told apart."""
        f = sys._getframe(1)
        frames = []
        while f is not None:
            if f.f_code.co_filename == STUDENT_FILE:
                frames.append(f)
            f = f.f_back
        if not frames:
            return None, [], []
        # frames[0] is the innermost; each call site is the line its caller (the next frame out) is on.
        calls = [fr.f_lineno for fr in frames[:0:-1]]
        ids = []
        for fr in frames[-2::-1]:  # the frames of the calls themselves, outermost first
            key = id(fr)
            if key not in self._call_ids:
                self._call_ids[key] = (len(self._call_ids) + 1, fr)  # keep fr alive: ids stay unique
            ids.append(self._call_ids[key][0])
        return frames[0].f_lineno, calls, ids

    def _spend_step(self):
        """Call FIRST in every API method, before any state changes: if the step cap is hit,
        nothing may change without a matching trace event, or replays would disagree with the
        engine's final state (caught by tests/js/frames.test.mjs)."""
        if len(self.trace) >= self.max_steps:
            recent = self.trace[-50:]
            stuck = all(e["action"] in SENSOR_NAMES for e in recent)  # only asking, never acting
            raise WorldError(
                "The robot has stopped doing anything, but a loop keeps going round: nothing inside it "
                "changes what the loop checks." if stuck else
                f"The program was stopped after {self.max_steps} robot actions without finishing. "
                "A loop is probably going round forever.",
                             "step_limit")

    def _record(self, action, **extra):
        line, calls, ids = self._student_lines()
        event = {"line": line, "action": action, "x": self.x, "y": self.y, "dir": self.dir, "bag": self.bag, **extra}
        if calls:
            event["calls"] = calls
            event["call_ids"] = ids
        printed = self.printed.tell() if self.printed is not None else 0
        if printed:
            event["out"] = printed  # how much print() output there was by this step (characters)
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
            picked_here = any(e["action"] == "pick" and (e["x"], e["y"]) == (self.x, self.y) for e in self.trace)
            raise WorldError("There's no gem here: the robot already picked it up." if picked_here
                             else "There's no gem here.", "no_gem")
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
                raise WorldError(f"{name}() is switched off in this level, so the program has to manage without it.", "unavailable")
            return stub
        return {n: unavailable(n) if n in self.hidden_commands else getattr(self, n) for n in API_NAMES}

    def gem_map(self):
        return {f"{x},{y}": n for (x, y), n in sorted(self.gems.items()) if n > 0}


# ---------------------------------------------------------------------------
# Running and checking
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Learner-facing error messages. Python's own wording ("'int' object is not iterable", "takes 1
# positional argument but 2 were given") is written for programmers; a learner gets the same
# error said plainly, pointing at the cause, never at the fix's code. `type` stays the real
# exception class (schemas/run_result.schema.json).
# ---------------------------------------------------------------------------

# Commands learners reach for that don't exist, with what to say instead.
MISSING_COMMANDS = {
    "turn_right": "There's no turn_right() command: the robot can only turn left. You can teach it one with def.",
    "turn_around": "There's no turn_around() command: the robot can only turn left. You can teach it one with def.",
    "pick_up": "There's no pick_up() command. The robot picks up a gem with pick().",
    "put_down": "There's no put_down() command. The robot puts down a gem with put().",
    "drop": "There's no drop() command. The robot puts down a gem with put().",
    "forward": "There's no forward() command. The robot steps forward with move().",
    "go": "There's no go() command. The robot steps forward with move().",
}


def _defined_names(tree):
    names = {}
    for node in ast.walk(tree) if tree else []:
        if isinstance(node, ast.FunctionDef):
            names.setdefault(node.name, node.lineno)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            names.setdefault(node.id, node.lineno)
    return names


def _name_error(name, line, code):
    try:
        tree = ast.parse(code)
    except SyntaxError:
        tree = None
    defined = _defined_names(tree)
    if name in defined and line and defined[name] > line:
        return (f"{name} is used on line {line}, but only defined on line {defined[name]}. "
                "Python reads from the top, so define it above the line that uses it.")
    if name in MISSING_COMMANDS:
        return MISSING_COMMANDS[name]
    known = list(API_NAMES) + [n for n in defined if not n.startswith("_")]
    close = difflib.get_close_matches(name, known, n=1, cutoff=0.7) or difflib.get_close_matches(name.lower(), known, n=1, cutoff=0.7)
    if close:
        target = close[0]
        call = f"{target}()" if target in API_NAMES or (tree and any(isinstance(n, ast.FunctionDef) and n.name == target for n in ast.walk(tree))) else target
        return f"Python doesn't know {name}. Did you mean {call}?"
    return f"Python doesn't know {name}: it isn't a command, and nothing called {name} has been made yet."


def _syntax_message(msg, line_text, prev_text=""):
    m = msg.lower()
    if re.search(r"\)\s+[A-Za-z_]\w*\s*\(", line_text or ""):
        return "Each command goes on a line of its own."
    starts_block = re.match(r"\s*(for|while|if|elif|else|def)\b", line_text or "")
    if starts_block and not (line_text or "").rstrip().endswith(":") and ("expected ':'" in m or "invalid syntax" in m):
        word = starts_block.group(1)
        return f"{'An' if word[0] in 'aeiou' else 'A'} {word} line ends with a colon (:)."
    if re.match(r"\s*def\s+\w+\s*:", line_text or ""):
        return "A def line needs brackets after the name, then a colon: name():"
    if "expected an indented block" in m:
        head = re.match(r"\s*(for|while|if|elif|else|def)\b", prev_text or "")
        what = f"this {head.group(1)}" if head else "a for, while, if or def"
        return f"The lines that belong to {what} go underneath it, indented by 4 spaces."
    if "unexpected indent" in m:
        return "This line is indented, but nothing above it starts a block. Line it up with the line above."
    if "unindent does not match" in m or "unindent" in m:
        return "This line's indentation doesn't line up with any line above it."
    if "inconsistent use of tabs and spaces" in m or "tab" in m:
        return "This line mixes tabs and spaces. Use spaces only (the Tab key here puts in spaces)."
    if "maybe you meant '=='" in m or ("cannot assign" in m and re.match(r"\s*(if|elif|while)\b", line_text or "")):
        return "To compare, use == (two equals signs). A single = gives something a name."
    if "was never closed" in m or "unexpected eof" in m:
        return "A bracket is opened but never closed."
    if "unmatched" in m:
        return "There's a closing bracket without an opening one."
    if "invalid syntax" in m or "perhaps you forgot a comma" in m:
        return "Python can't read this line. Check the brackets, colons and spelling."
    return f"Python can't read this line ({msg})."


def _runtime_message(e, code):
    text = str(e)
    if isinstance(e, NameError) and not isinstance(e, UnboundLocalError):
        m = re.search(r"name '(\w+)' is not defined", text)
        if m:
            return None, m.group(1)  # worded with the line (_name_error)
    if isinstance(e, UnboundLocalError):
        m = re.search(r"'(\w+)'", text)
        name = m.group(1) if m else "a variable"
        return (f"{name} is changed inside this function, so Python treats it as the function's own {name}, "
                f"separate from the one outside, and that one has no value yet. Change {name} outside the "
                "function instead, or pass it in and give the new value back with return."), None
    if isinstance(e, RecursionError):
        return "A function keeps calling itself and never stops.", None
    if isinstance(e, ZeroDivisionError):
        return "The program divides by zero.", None
    if isinstance(e, ValueError) and "is not in list" in text:
        if "built-in function" in text or "function" in text:
            return "A function is used without its brackets, so Python looks for the function itself in the list. Write it with ().", None
        return "index() looks for that value in the list, and it isn't there.", None
    if isinstance(e, AttributeError):
        m = re.search(r"'(int|bool|float)' object has no attribute '(\w+)'", text)
        if m:
            return f"{m.group(2)}() works on a list, but this is a single number.", None
    if isinstance(e, IndexError):
        return "That position isn't in the list. A list's positions start at 0 and stop one before its length.", None
    if isinstance(e, TypeError):
        m = re.search(r"(\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given", text)
        if m:
            name, want, got = m.group(1), int(m.group(2)), int(m.group(3))
            if name in API_NAMES:  # bound methods count self
                return f"{name}() doesn't take anything in its brackets: leave them empty.", None
            return f"{name}() was given {got} value{'s' * (got != 1)} in its brackets, but takes {want}.", None
        m = re.search(r"(\w+)\(\) missing (\d+) required positional argument", text)
        if m:
            return f"{m.group(1)}() needs {m.group(2)} more value{'s' * (int(m.group(2)) != 1)} in its brackets.", None
        if "'float' object cannot be interpreted as an integer" in text:
            return "range() needs a whole number, but / makes a number with a decimal point. // divides and keeps a whole number.", None
        if "can only concatenate list" in text:
            return "+ can join two lists, but not a list and a number. Is the + inside the wrong brackets?", None
        if "cannot be interpreted as an integer" in text:
            return "range() needs a whole number, like range(5), not text in quotes or a decimal.", None
        if "object is not iterable" in text and "int" in text:
            return "for needs something to count through, like range(): a number on its own can't be looped over.", None
        if "not supported between instances of" in text and "str" in text:
            return "This compares a number with text. Numbers don't go in quotes.", None
        if "method" in text or "function" in text:
            return "A command is used without its brackets, so Python gets the command itself, not its answer. Write it with ().", None
    return text, None


def _outer_loop_line(code, line):
    """The outermost loop around `line` (the student's outermost frame): the one going round forever."""
    if not line:
        return None
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None
    loops = [n for n in ast.walk(tree) if isinstance(n, (ast.While, ast.For)) and n.lineno <= line <= n.end_lineno]
    return min(loops, key=lambda n: n.lineno).lineno if loops else None


def _not_called(tree):
    """A command or function named without its brackets: `move` (does nothing) or
    `while front_is_clear:` (always true). Python allows both, silently; a learner meant a call."""
    if tree is None:
        return None
    funcs = set(API_NAMES) | {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    for node in ast.walk(tree):
        if isinstance(node, (ast.For, ast.While)) and node.orelse:
            word = "for" if isinstance(node, ast.For) else "while"
            line = node.orelse[0].lineno - 1
            return line, (f"This else lines up with the {word}, so it would run once after the loop ends, not "
                          "each time round. To pair it with an if, indent it to line up with that if.")
        if isinstance(node, (ast.Assign, ast.Return)) and isinstance(node.value, ast.Name) and node.value.id in API_NAMES:
            name = node.value.id
            return node.lineno, f"{name} without brackets is the command itself, not its answer. Write {name}()."
        for body in (getattr(node, "body", None), getattr(node, "orelse", None)):
            if isinstance(body, list):
                for k, stmt in enumerate(body[:-1]):
                    if isinstance(stmt, ast.Return):
                        return body[k + 1].lineno, (f"This line never runs: the return on line {stmt.lineno} has "
                                                    "already ended the function. Put return last.")
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Name) and node.value.id in funcs:
            name = node.value.id
            return node.lineno, f"{name} without brackets doesn't do anything. To run it, write {name}()."
        if isinstance(node, (ast.If, ast.While)):
            for part in ast.walk(node.test):
                if isinstance(part, ast.Name) and part.id in funcs and not _is_called(node.test, part):
                    word = "while" if isinstance(node, ast.While) else "if"
                    if any(isinstance(c, ast.UnaryOp) and isinstance(c.op, ast.Not) and c.operand is part for c in ast.walk(node.test)):
                        return node.lineno, (f"{part.id} without brackets is the command itself, so not {part.id} is "
                                             f"always False and this {word} never runs. Write {part.id}().")
                    if any(isinstance(c, ast.Compare) and part in ast.walk(c) for c in ast.walk(node.test)):
                        return node.lineno, (f"{part.id} without brackets is the command itself, not its answer, "
                                             f"so there's nothing to compare. Write {part.id}().")
                    return node.lineno, (f"{part.id} without brackets is the command itself, which counts as always "
                                         f"true, so this {word} doesn't ask the robot anything. Write {part.id}().")
    return None


def _is_called(test, name_node):
    return any(isinstance(n, ast.Call) and n.func is name_node for n in ast.walk(test))


def run_program(code, spec, seed=0, hidden_commands=()):
    """Run learner code against one world. Never raises; every learner error becomes data.

    Each call gets a fresh World and a fresh namespace, and captures print() output, so a
    reused (warm) interpreter cannot leak state between runs (docs/decisions.md D4).
    Returns a dict matching schemas/run_result.schema.json.
    """
    return _execute(code, spec, seed, hidden_commands)[0]


def _execute(code, spec, seed=0, hidden_commands=()):
    """run_program, also returning the namespace the code ran in (quest tests read a return value)."""
    world = World(spec, seed, hidden_commands)
    namespace = {"__name__": "__main__", **world.api()}
    error = None
    printed = io.StringIO()
    world.printed = printed
    try:
        compiled = compile(code, STUDENT_FILE, "exec")
        slip = _not_called(ast.parse(code))  # `move` or `while front_is_clear:`: legal, silently wrong
        if slip:
            error = {"type": "MissingBrackets", "message": slip[1], "line": slip[0]}
        else:
            with contextlib.redirect_stdout(printed):
                exec(compiled, namespace)
    except SyntaxError as e:
        lines = code.split("\n")
        text = lines[e.lineno - 1] if e.lineno and e.lineno <= len(lines) else ""
        prev = next((ln for ln in reversed(lines[:max(0, (e.lineno or 1) - 1)]) if ln.strip()), "")
        error = {"type": type(e).__name__, "message": _syntax_message(e.msg, text, prev), "line": e.lineno}
    except Exception as e:  # noqa: BLE001
        tb, lines = e.__traceback__, []
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == STUDENT_FILE:
                lines.append(tb.tb_lineno)
            tb = tb.tb_next
        if isinstance(e, RecursionError) and lines:
            # Point at the call that repeats, not at whatever ran last; keep one call site.
            line = collections.Counter(lines).most_common(1)[0][0]
            lines = [lines[0], line] if lines[0] != line else [line]
        line = lines[-1] if lines else None
        if isinstance(e, WorldError):
            message = str(e)
        else:
            message, missing = _runtime_message(e, code)
            if missing:
                message = _name_error(missing, line, code)
        if isinstance(e, WorldError) and e.kind == "step_limit":
            outer = _outer_loop_line(code, lines[0] if lines else None)
            if outer:
                message += f" It's the loop that starts on line {outer}."
        error = {"type": type(e).__name__, "message": message, "line": line}
        if len(lines) > 1:
            error["calls"] = lines[:-1]  # the call sites it happened inside, outermost first
        if isinstance(e, WorldError):
            error["kind"] = e.kind
    gems = world.gem_map()
    return {"format": FORMAT_VERSION, "trace": world.trace, "error": error, "output": printed.getvalue(),
            "final": {"x": world.x, "y": world.y, "dir": world.dir, "bag": world.bag,
                      "gems_left": sum(gems.values()), "gems": gems}}, namespace


DIR_WORDS = {"E": "east (→)", "N": "north (↑)", "W": "west (←)", "S": "south (↓)"}


def _plural(n, word, plural=None):
    return f"{n} {word if n == 1 else (plural or word + 's')}"


def _cell_roles(spec):
    """Names a learner can see for cells, instead of coordinates: the start cell, and the last
    cell straight ahead of the start (by the wall), which is where fenceposts go wrong."""
    if not spec:
        return {}
    x, y, d = spec["start"]
    dx, dy = {"E": (1, 0), "W": (-1, 0), "N": (0, -1), "S": (0, 1)}[d]
    blocked = {tuple(c) for c in spec.get("blocked", [])}
    lx, ly = x, y
    while 0 <= lx + dx < spec["width"] and 0 <= ly + dy < spec["height"] and (lx + dx, ly + dy) not in blocked:
        lx, ly = lx + dx, ly + dy
    roles = {f"{x},{y}": "the cell the robot started on"}
    if (lx, ly) != (x, y):
        roles[f"{lx},{ly}"] = "the last cell before the wall"
    return roles


def _describe_layout_difference(actual, expected, spec=None):
    """Which cells are wrong, said by role or by count, never by coordinates (D14)."""
    roles = _cell_roles(spec)
    start = (spec or {}).get("gems", {})
    missing = [k for k in expected if actual.get(k, 0) < expected[k]]
    extra = [k for k in actual if actual[k] > expected.get(k, 0)]
    # A pile that was there from the start and is still there wasn't collected; "too many" would
    # sound like the robot put gems down.
    uncollected = [k for k in extra if actual[k] <= start.get(k, 0) and not expected.get(k, 0)]
    added = [k for k in extra if k not in uncollected]
    parts = []
    for cells, one, many in ((missing, "needs more gems", "need more gems"),
                             (uncollected, "still has gems that should be collected", "still have gems that should be collected"),
                             (added, "has too many gems", "have too many gems")):
        if not cells:
            continue
        named = [roles[k] for k in cells if k in roles]
        if len(cells) == 1:
            parts.append(f"{named[0] if named else 'one cell'} {one}")
        else:
            also = f", including {' and '.join(named)}" if named else ""
            parts.append(f"{len(cells)} cells {many}{also}")
    text = "; ".join(parts)
    return text[:1].upper() + text[1:] + ". Compare the floor with the Goal picture."


def _end_failure(f, goal):
    want_x, want_y = goal["end_at"]
    dx, dy = want_x - f["x"], want_y - f["y"]
    if dx and not dy:
        return f"The robot should stop {_plural(abs(dx), 'cell')} further {DIR_WORDS['E' if dx > 0 else 'W']}."
    if dy and not dx:
        return f"The robot should stop {_plural(abs(dy), 'cell')} further {DIR_WORDS['S' if dy > 0 else 'N']}."
    return "The robot should stop on the marked cell in the Goal picture."


def _idle_reason(code, result):
    """A run that ended without the robot doing anything says so, and names the functions that
    are written but never called (the commonest cause: a def only teaches a command)."""
    if result["error"] or any(e["action"] not in SENSOR_NAMES for e in result["trace"]):
        return None
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None
    uncalled = [n.name for n in tree.body if isinstance(n, ast.FunctionDef) and not _called_outside(tree, n.name)]
    if uncalled:
        names = " and ".join(f"{n}()" for n in uncalled[:3])
        return (f"The robot didn't do anything: your code teaches it {names} but nothing calls "
                f"{'it' if len(uncalled) == 1 else 'them'}. A def only teaches a command; to run it, "
                f"write {uncalled[0]}() on a line of its own, not indented.")
    return None  # nothing uncalled: the goal's own message ("3 gems were left behind…") says more


def _goal_failures(result, goal, spec=None):
    out, f = [], result["final"]
    if goal.get("no_error", True) and result["error"]:
        # A crash explains everything after it; listing its knock-on effects is noise (D14).
        return [f"Stopped on line {result['error']['line']}: {result['error']['message']}"]
    if goal.get("all_gems_collected") and f["gems_left"]:
        n = f["gems_left"]
        start = f"{spec['start'][0]},{spec['start'][1]}" if spec else None
        on_start = f["gems"].get(start, 0) if start else 0
        where = ", on the cell the robot started on" if on_start == n else (
            f", {on_start} of them on the cell the robot started on" if on_start else "")
        out.append(f"{_plural(n, 'gem')} {'was' if n == 1 else 'were'} left behind{where}.")
    if "gems_exactly" in goal and f["gems"] != goal["gems_exactly"]:
        out.append(_describe_layout_difference(f["gems"], goal["gems_exactly"], spec))
    if "end_at" in goal and [f["x"], f["y"]] != goal["end_at"]:
        out.append(_end_failure(f, goal))
    if "facing" in goal and f["dir"] != goal["facing"]:
        out.append(f"The robot should finish facing {DIR_WORDS[goal['facing']]}, not {DIR_WORDS[f['dir']]}.")
    if "bag_at_least" in goal and f["bag"] < goal["bag_at_least"]:
        want = goal["bag_at_least"]
        out.append(f"The bag should hold at least {_plural(want, 'gem')}, not {f['bag']}.")
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
    # "def" alone is met by a starter's turn_right(); these say which functions must do the work.
    for name in constraints.get("use_functions", []):
        if not _defines(tree, name):
            out.append(f"This level asks you to write {name}() with def.")
        elif not _called_outside(tree, name):
            out.append(f"This level asks you to use your {name}(): it's defined, but nothing calls it.")
    for name in constraints.get("loop_calls", []):
        if not _called_in_for(tree, name):
            out.append(f"This level asks you to call {name}() from inside a for loop.")
    return out


def _defines(tree, name):
    return any(isinstance(n, ast.FunctionDef) and n.name == name for n in tree.body)


def _calls_in(node, name):
    return any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == name for n in ast.walk(node))


def _called_outside(tree, name):
    """Called somewhere other than inside its own definition (directly, or from another function)."""
    return any(_calls_in(n, name) for n in tree.body if not (isinstance(n, ast.FunctionDef) and n.name == name))


def _called_in_for(tree, name):
    """Called from the body of a for loop that isn't inside the function itself."""
    def walk(node, own):
        for child in ast.iter_child_nodes(node):
            inside = own or (isinstance(child, ast.FunctionDef) and child.name == name)
            if isinstance(child, ast.For) and not inside and any(_calls_in(b, name) for b in child.body):
                return True
            if walk(child, inside):
                return True
        return False
    return walk(tree, False)


# ---------------------------------------------------------------------------
# Guided steps (lesson "done_when" checks, docs/lessons.md section 5.3)
# ---------------------------------------------------------------------------

_STEP_KINDS = {"for": ast.For, "while": ast.While, "if": ast.If, "def": ast.FunctionDef, "return": ast.Return}


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
                # "before"/"after": a top-level statement above or below the first top-level
                # loop of that kind (the fencepost's extra put goes after the while, not before).
                for side in ("before", "after"):
                    if side in check:
                        loops = [t for t in tree.body if isinstance(t, _STEP_KINDS[check[side]])]
                        # strictly above the loop's first line, or strictly below its last
                        ok = loops and not stack and (stmt.lineno < loops[0].lineno if side == "before"
                                                      else stmt.lineno > loops[0].end_lineno)
                        if not ok:
                            break
                else:
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
        failures = _goal_failures(result, goal_for(level, spec), spec)
        idle = failures and _idle_reason(code, result)
        if idle:
            failures = [idle]
        reports.append({"world": name, "passed": not failures, "failures": failures,
                        # Every world's run, so any of them can be watched: what went wrong in
                        # a failed one, and how the program copes in one that passed.
                        "result": result})
    constraint_failures = check_constraints(code, level.get("constraints", {}))
    return {"passed": all(r["passed"] for r in reports) and not constraint_failures,
            "worlds": reports, "constraint_failures": constraint_failures,
            "lines": line_goal(code, level.get("constraints", {}))}


# ---------------------------------------------------------------------------
# Sub-quests (quests/<id>.json, docs/quests.md): a level broken into smaller problems, each
# checked on its own. Three kinds of check:
#   test     one of the learner's functions on its own: only their definitions run (every other
#            top-level line is blanked, so line numbers stay true), then one call, in a small world
#   program  the whole program, on a smaller world (a short version of the problem) or the
#            level's own; judged by a goal and/or `reach` (it got somewhere / picked or put there)
#   code     the shape of the code (check_code checks): use sparingly
# Messages say what happened, never how to fix it.
# ---------------------------------------------------------------------------

QUEST_KEEP = (ast.FunctionDef, ast.Import, ast.ImportFrom)
QUEST_CALL_NAME = "__quest_result__"


def definitions_only(code):
    """The code with every top-level statement except definitions (and constant assignments,
    docstrings, imports) replaced by blank lines, so a function can be tested on its own with
    its real line numbers. None if the code doesn't parse."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None
    lines = code.split("\n")
    for node in tree.body:
        keep = isinstance(node, QUEST_KEEP) or (
            isinstance(node, (ast.Assign, ast.AnnAssign, ast.Expr)) and isinstance(node.value, ast.Constant))
        if not keep:
            for i in range(node.lineno - 1, node.end_lineno):
                lines[i] = ""
    return "\n".join(lines)


def _defined(code, name):
    try:
        return any(isinstance(n, ast.FunctionDef) and n.name == name for n in ast.parse(code).body)
    except SyntaxError:
        return False


def _reach_failures(result, reach, world):
    out = []
    start = world["start"]
    states = [tuple(start[:2])] + [(e["x"], e["y"]) for e in result["trace"]]
    if "visit" in reach and tuple(reach["visit"]) not in states:
        out.append("The robot never gets to the marked cell.")
    for key, action, words in (("pick_at", "pick", "picks up"), ("put_at", "put", "puts down")):
        if key in reach:
            cell, n = reach[key], reach.get("n", 1)
            where = "on its starting cell" if list(cell) == list(start[:2]) else "on the marked cell"
            got = sum(1 for e in result["trace"] if e["action"] == action and [e["x"], e["y"]] == list(cell))
            if got < n:
                out.append(f"The robot {words} {_plural(got, 'gem')} {where}, not {n}." if got
                           else f"The robot never {words} a gem {where}.")
    if "gems_then" in reach and not out:
        # The floor at the moment the part is reached: the marked put (or pick), or, for a visit,
        # the robot's first arrival on the marked cell (say, the start of the next row: one whole
        # pass of a loop). The part is the state then, not just one gem landing somewhere.
        key = next(k for k in ("put_at", "pick_at", "visit") if k in reach)
        action = {"put_at": "put", "pick_at": "pick", "visit": None}[key]
        gems, count = dict(world.get("gems", {})), 0
        for e in result["trace"]:
            if e["action"] in ("put", "pick"):
                k = f"{e['x']},{e['y']}"
                gems[k] = gems.get(k, 0) + (1 if e["action"] == "put" else -1)
                if not gems[k]:
                    del gems[k]
            if (action is None or e["action"] == action) and [e["x"], e["y"]] == list(reach[key]):
                count += 1
                if action is None or count == reach.get("n", 1):
                    break
        if gems != reach["gems_then"]:
            out.append("When the robot gets to the marked cell, the gems so far don't match the picture.")
    return out


def _quest_failures(result, goal, world=None):
    """Like _goal_failures, but said against the sub-quest's picture (no coordinates): a learner
    compares their replay with the picture, not with [x, y] pairs."""
    f = result["final"]
    if goal.get("no_error", True) and result["error"]:
        return _goal_failures(result, goal)[:1]  # the crash, with its line (D14)
    out = []
    if goal.get("all_gems_collected") and f["gems_left"]:
        n = f["gems_left"]
        out.append(f"{n} gem{'' if n == 1 else 's'} {'is' if n == 1 else 'are'} still on the floor.")
    if "gems_exactly" in goal and f["gems"] != goal["gems_exactly"]:
        want, got = goal["gems_exactly"], f["gems"]
        short = any(got.get(k, 0) < n for k, n in want.items())
        extra = any(n > want.get(k, 0) for k, n in got.items())
        start_gems = (world or {}).get("gems", {})
        left_over = extra and all(n <= start_gems.get(k, 0) for k, n in got.items() if n > want.get(k, 0))
        out.append("The gems don't match the picture: some cells have too few, others too many." if short and extra
                   else "Some cells in the picture are still missing gems." if short
                   else "A gem the picture doesn't show is still on the floor: it should be picked up." if left_over
                   else "Some cells end up with more gems than the picture shows.")
    if "end_at" in goal and [f["x"], f["y"]] != goal["end_at"]:
        out.append("The robot doesn't end on the marked cell.")
    if "facing" in goal and f["dir"] != goal["facing"]:
        out.append(f"The robot ends facing {DIR_WORDS[f['dir']]}, not {DIR_WORDS[goal['facing']]}.")
    if "bag_at_least" in goal and f["bag"] < goal["bag_at_least"]:
        out += _goal_failures(result, {"no_error": False, "bag_at_least": goal["bag_at_least"]})
    return out


def _code_failure(code, checks):
    """What a code-shape sub-quest is still missing, in a few words."""
    try:
        ast.parse(code)
    except SyntaxError:
        return "Python can't read the code yet: fix the line marked in red first."
    for check, ok in zip(checks, check_code(code, checks)):
        if ok:
            continue
        if "has" in check:
            word = CONSTRUCT_WORDS.get(check["has"], check["has"])
            return f"The code doesn't use {word} yet."
        if "defines" in check:
            return f"There's no {check['defines']}() yet."
        if "calls" in check:
            return f"Nothing calls {check['calls']}() yet."
        return "Not in the code yet."
    return None


def _quest_one(code, level, quest, hidden):
    check = quest["check"]
    if "code" in check:
        why = _code_failure(code, check["code"])
        # The run on the level's world, to watch: the shape is the part, the run shows it works.
        return {"done": why is None, "why": why, "result": run_program(code, level["world"], 0, hidden)}
    if "test" in check:
        t = check["test"]
        name = t["call"]
        if not _defined(code, name):
            return {"done": False, "why": f"There's no {name}() to test yet. This part tests a function with exactly that name.",
                    "result": None, "missing": True}
        defs = definitions_only(code)
        args = ", ".join(repr(a) for a in t.get("args", []))
        # The call goes on the line after the learner's last line, so it never lands on (and is
        # never drawn on) a line of theirs.
        source = defs + f"\n{QUEST_CALL_NAME} = {name}({args})\n"
        result, namespace = _execute(source, t["world"], 0, hidden)
        failures = _quest_failures(result, t.get("goal", {}), t["world"])
        if failures and not result["error"] and all(e["action"] in SENSOR_NAMES for e in result["trace"]):
            failures = [f"{name}() ran, but the robot didn't do anything."]
        if not failures and "returns" in t:
            got = namespace.get(QUEST_CALL_NAME)
            if got != t["returns"]:
                failures.append(f"{name}() gave back {_describe_value(got)}, but should give back {_py(t['returns'])}.")
        return {"done": not failures, "why": failures[0] if failures else None, "result": result}
    p = check["program"]
    world = p.get("world", level["world"])
    result = run_program(code, world, 0, hidden)
    reach = p.get("reach", {})
    if reach and not p.get("goal"):
        # "Did it get there?" is about the way, not the end: a part reached before a later crash
        # is done. Not reached, a crash is the reason given (it explains what came after, D14).
        failures = _reach_failures(result, reach, world)
        if failures and result["error"]:
            failures = _quest_failures(result, {})
    else:
        failures = _quest_failures(result, p.get("goal", {}), world)
        if not result["error"]:  # a crash explains everything after it (D14)
            failures += _reach_failures(result, reach, world)
    idle = failures and _idle_reason(code, result)
    if idle:
        failures = [idle]
    return {"done": not failures, "why": failures[0] if failures else None, "result": result}


def _py(v):
    return {True: "True", False: "False", None: "None"}.get(v, repr(v)) if isinstance(v, (bool, type(None))) else repr(v)


def _describe_value(v):
    if v is None:
        return "nothing (no return line gave back an answer)"
    if callable(v):
        return f"{getattr(v, '__name__', 'a command')} itself (without brackets), not its answer"
    return _py(v)


def quest_state(code, level, quests):
    """One {done, why, result} per sub-quest. `result` is the run behind it, for the sub-quest's
    page to replay: the test's run, the program on the part's world, or (for a code-shape part)
    the program on the level's world."""
    hidden = level.get("constraints", {}).get("hidden_commands", [])
    return {"quests": [_quest_one(code, level, q, hidden) for q in quests]}


def validate_quests(doc, level):
    """Check a quests file's shape against its level (mirrors schemas/quests.schema.json)."""
    if not isinstance(doc, dict) or doc.get("format") != 1 or doc.get("level") != level["id"]:
        raise LevelError(f"quests: expected format 1 for level {level['id']!r}")
    quests = doc.get("quests")
    if not isinstance(quests, list) or not 2 <= len(quests) <= 5:
        raise LevelError("quests: 2 to 5 sub-quests")
    ids = set()
    for i, q in enumerate(quests):
        path = f"quests[{i}]"
        for key in ("id", "title", "ask", "check"):
            if key not in q:
                raise LevelError(f"{path}: missing '{key}'")
        if set(q) - {"id", "title", "ask", "nudge", "check"}:
            raise LevelError(f"{path}: unknown keys {sorted(set(q) - {'id', 'title', 'ask', 'nudge', 'check'})}")
        if q["id"] in ids:
            raise LevelError(f"{path}.id: {q['id']!r} is used twice")
        ids.add(q["id"])
        check = q["check"]
        if not isinstance(check, dict) or len(check) != 1 or not set(check) <= {"test", "program", "code"}:
            raise LevelError(f"{path}.check: exactly one of test, program, code")
        if "test" in check:
            t = check["test"]
            if not isinstance(t.get("call"), str) or not t["call"].isidentifier():
                raise LevelError(f"{path}.check.test.call: a function name")
            validate_world(t.get("world"), f"{path}.check.test.world")
            w = t["world"]
            if "goal" in t:
                validate_goal(t["goal"], f"{path}.check.test.goal", w["width"], w["height"], partial=True)
            if "goal" not in t and "returns" not in t:
                raise LevelError(f"{path}.check.test: needs a goal or returns")
        elif "program" in check:
            p = check["program"]
            w = p.get("world", level["world"])
            if "world" in p:
                validate_world(p["world"], f"{path}.check.program.world")
            if "goal" in p:
                validate_goal(p["goal"], f"{path}.check.program.goal", w["width"], w["height"], partial=True)
            reach = p.get("reach", {})
            for key in ("visit", "pick_at", "put_at"):
                if key in reach:
                    _cell(reach[key], f"{path}.check.program.reach.{key}", w["width"], w["height"])
            if "gems_then" in reach:
                if not ("put_at" in reach or "pick_at" in reach or "visit" in reach):
                    raise LevelError(f"{path}.check.program.reach.gems_then: goes with put_at, pick_at or visit")
                _gem_map(reach["gems_then"], f"{path}.check.program.reach.gems_then", w["width"], w["height"])
            if not p.get("goal") and not reach:
                raise LevelError(f"{path}.check.program: needs a goal or reach")
        elif not isinstance(check["code"], list) or not check["code"]:
            raise LevelError(f"{path}.check.code: a list of checks")


def trace_digest(result):
    """Stable short hash of a run result: the cross-runtime contract compares these."""
    return hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()[:16]
