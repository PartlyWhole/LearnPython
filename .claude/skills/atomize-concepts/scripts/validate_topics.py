#!/usr/bin/env python3
"""Validate topic batch files against the schema and the rest of the topic graph.

Usage:
  python3 validate_topics.py <project_root> B05        # one batch, in the context of earlier waves
  python3 validate_topics.py <project_root> --all      # every batch file, plus cross-batch checks

Exit code 1 if any ERROR. WARN lines are judgment calls worth a second look.
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

FORMATS = {"multiple_choice", "predict_output", "fill_in_blank", "write_code", "fix_the_bug",
           "parsons", "short_answer", "trace_table", "numeric"}
ID_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")


def load_all(root):
    plan = json.loads((root / "topics" / "plan.json").read_text())
    wave_of, batch_concepts = {}, {}
    for w in plan["waves"]:
        for b in w["batches"]:
            wave_of[b["id"]] = w["wave"]
            batch_concepts[b["id"]] = b["concepts"]
    files = {}
    for f in sorted((root / "topics").glob("B*.json")):
        try:
            files[json.loads(f.read_text())["batch"]] = (f, json.loads(f.read_text()))
        except Exception as e:  # noqa: BLE001
            print(f"ERROR {f.name}: not valid JSON ({e})")
    agg = json.loads((root / "aggregate" / "aggregate.json").read_text())
    return plan, wave_of, batch_concepts, files, {c["id"] for c in agg["concepts"]}, {c["id"] for c in agg["courses"]}


def ancestors(tid, prereq):
    seen, stack = set(), list(prereq.get(tid, []))
    while stack:
        p = stack.pop()
        if p not in seen:
            seen.add(p)
            stack.extend(prereq.get(p, []))
    return seen


def check_batch(bid, data, visible, wave_topics, batch_concepts, concept_ids, course_ids, out, noncore_earlier=frozenset()):
    err = lambda m: out.append(f"ERROR {bid}: {m}")  # noqa: E731
    warn = lambda m: out.append(f"WARN  {bid}: {m}")  # noqa: E731
    concepts = set(batch_concepts.get(bid, []))
    if not concepts:
        err("batch id not in plan.json")
    topics = data.get("topics", [])
    ids = [t.get("id") for t in topics]
    for d in {i for i in ids if ids.count(i) > 1}:
        err(f"duplicate topic id {d}")
    local = set(ids)
    cmap = data.get("concept_map", {})
    for c in concepts:
        if c not in cmap:
            err(f"concept_map missing {c}")
    for c, entry in cmap.items():
        if c not in concepts:
            warn(f"concept_map has {c}, which is not in this batch")
        for t in entry.get("covered_by", []):
            if t not in visible:
                err(f"concept_map[{c}].covered_by unknown topic {t}")
        if entry.get("umbrella") or entry.get("covered_by"):
            continue
        listed = entry.get("topics", [])
        if not listed:
            err(f"concept {c} has no topics (use covered_by or umbrella if intentional)")
        for t in listed:
            if t not in local:
                err(f"concept_map[{c}] lists unknown topic {t}")
        if entry.get("entry_topic") and entry["entry_topic"] not in listed:
            err(f"concept_map[{c}].entry_topic not among its topics")
    mapped = [t for e in cmap.values() for t in e.get("topics", [])]
    for t in local:
        n = mapped.count(t)
        if n != 1:
            err(f"topic {t} appears in {n} concept_map topic lists (expected exactly 1)")
    core = {t["id"] for t in topics if t.get("core")}

    prereq = {t["id"]: list(t.get("prerequisites", [])) for t in topics if "id" in t}
    prereq.update({k: v for k, v in wave_topics.items() if k not in prereq})
    for t in topics:
        tid = t.get("id", "?")
        if not ID_RE.match(tid or ""):
            err(f"{tid}: id must be <concept>.<snake_slug>")
        elif tid.split(".")[0] != t.get("concept"):
            err(f"{tid}: id prefix must equal its concept ({t.get('concept')})")
        if t.get("concept") not in concepts:
            err(f"{tid}: concept {t.get('concept')} is not in this batch")
        for key in ("title", "summary", "minutes", "knowledge_points", "prerequisites", "core"):
            if key not in t:
                err(f"{tid}: missing {key}")
        m = t.get("minutes", 0)
        if not isinstance(m, (int, float)) or m < 8 or m > 35:
            err(f"{tid}: minutes {m} outside 8-35")
        elif m < 12 or m > 25:
            warn(f"{tid}: minutes {m} outside the 12-25 sweet spot")
        pre = t.get("prerequisites", [])
        if len(pre) > 5:
            err(f"{tid}: {len(pre)} direct prerequisites (max 4, split the topic)")
        elif len(pre) == 5:
            warn(f"{tid}: 5 direct prerequisites (aim for <= 4)")
        for p in pre:
            if p not in visible:
                err(f"{tid}: prerequisite {p} does not exist in this or an earlier wave")
            if p == tid:
                err(f"{tid}: lists itself as a prerequisite")
        if t.get("core"):
            for p in pre:
                if (p in local and p not in core) or (p in noncore_earlier):
                    warn(f"{tid}: core topic depends on non-core {p} (make {p} core or drop core here)")
        for p in t.get("pending_prerequisites", []):
            if not p.startswith("concept:") or p[8:] not in concept_ids:
                err(f"{tid}: pending_prerequisites entry {p} must be concept:<known concept id>")
        anc = ancestors(tid, prereq)
        kps = t.get("knowledge_points", [])
        if not 2 <= len(kps) <= 5:
            err(f"{tid}: {len(kps)} knowledge points (expected 3-4)")
        elif len(kps) not in (3, 4):
            warn(f"{tid}: {len(kps)} knowledge points (3-4 is the norm)")
        for i, kp in enumerate(kps, 1):
            for key in ("title", "worked_example", "practice", "formats", "key_prerequisites"):
                if key not in kp:
                    err(f"{tid} KP{i}: missing {key}")
            bad = set(kp.get("formats", [])) - FORMATS
            if bad:
                err(f"{tid} KP{i}: unknown formats {sorted(bad)}")
            if len(kp.get("key_prerequisites", [])) > 4:
                warn(f"{tid} KP{i}: more than 4 key prerequisites")
            for k in kp.get("key_prerequisites", []):
                if k not in visible:
                    err(f"{tid} KP{i}: key prerequisite {k} does not exist")
                elif k not in anc:
                    warn(f"{tid} KP{i}: key prerequisite {k} is not an ancestor of the topic")
        for e in t.get("encompasses", []):
            tgt, w = e.get("topic"), e.get("weight")
            if tgt not in visible:
                err(f"{tid}: encompasses unknown topic {tgt}")
            if not isinstance(w, (int, float)) or not 0 < w <= 1:
                err(f"{tid}: encompassing weight {w} for {tgt} must be in (0, 1]")
            if tgt not in anc and not e.get("non_ancestor"):
                warn(f"{tid}: encompasses {tgt}, which is not an ancestor (set non_ancestor: true if intended)")
        for c in t.get("taught_in", []):
            if c not in course_ids:
                err(f"{tid}: taught_in has unknown course {c}")
    return prereq


def find_cycle(prereq):
    color, stack = {}, []

    def dfs(n):
        color[n] = 1
        stack.append(n)
        for p in prereq.get(n, []):
            if color.get(p) == 1:
                return stack[stack.index(p):] + [p]
            if color.get(p) is None:
                c = dfs(p)
                if c:
                    return c
        color[n] = 2
        stack.pop()
        return None

    for n in list(prereq):
        if color.get(n) is None:
            c = dfs(n)
            if c:
                return c
    return None


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    root = Path(sys.argv[1]).resolve()
    plan, wave_of, batch_concepts, files, concept_ids, course_ids = load_all(root)
    targets = sorted(files) if sys.argv[2] == "--all" else [sys.argv[2]]
    out, prereq_all = [], {}
    for bid in targets:
        if bid not in files:
            sys.exit(f"no file for batch {bid} in topics/")
        _, data = files[bid]
        w = wave_of.get(bid, 99)
        earlier = {t["id"]: t.get("prerequisites", []) for b, (_, d) in files.items()
                   if wave_of.get(b, 99) < w for t in d["topics"]}
        visible = set(earlier) | {t["id"] for t in data["topics"]}
        noncore = {t["id"] for b, (_, d) in files.items() if b != bid for t in d["topics"] if not t.get("core")}
        if sys.argv[2] == "--all":  # same-wave siblings are fine once everything exists
            visible |= {t["id"] for _, (_, d) in files.items() for t in d["topics"]}
        prereq_all.update(check_batch(bid, data, visible, earlier, batch_concepts,
                                      concept_ids, course_ids, out, noncore))
    cyc = find_cycle(prereq_all)
    if cyc:
        out.append("ERROR: prerequisite cycle " + " -> ".join(cyc))
    if sys.argv[2] == "--all":
        written = {c for _, (_, d) in files.items() for c in d.get("concept_map", {})}
        planned = {c for b in batch_concepts.values() for c in b}
        missing = sorted(planned - written)
        if missing:
            out.append(f"INFO: {len(missing)} planned concepts not written yet")
        pending = defaultdict(list)
        for _, (_, d) in files.items():
            for t in d["topics"]:
                for p in t.get("pending_prerequisites", []):
                    pending[p[8:]].append(t["id"])
        for c, ts in sorted(pending.items()):
            state = "resolvable" if c in written else "STILL UNWRITTEN"
            out.append(f"PENDING concept:{c} ({state}) needed by {len(ts)} topic(s): {', '.join(ts[:4])}")
    n_topics = sum(len(files[b][1]["topics"]) for b in targets)
    errors = sum(1 for line in out if line.startswith("ERROR"))
    for line in out:
        print(line)
    print(f"\n{len(targets)} batch(es), {n_topics} topics, {errors} errors, "
          f"{sum(1 for l in out if l.startswith('WARN'))} warnings")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
