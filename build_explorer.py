#!/usr/bin/env python3
"""Build explorer.html from aggregate/aggregate.json + explorer_template.html.

Run after merge.py:  python3 merge.py && python3 build_explorer.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SHORT = {
    "helsinki_mooc": "Helsinki MOOC",
    "cs50p": "CS50P",
    "py4e": "Py4E",
    "mit_6100l": "MIT 6.100L",
    "100_days_of_code": "100 Days",
    "bootdev": "Boot.dev",
    "code_in_place": "Code in Place",
    "codecademy": "Codecademy",
}
ORDER = list(SHORT)
GROUPS = {  # category -> display group
    "fundamentals": "core", "strings": "core", "control_flow": "core", "functions": "core",
    "collections": "data", "files_io": "io", "errors_testing": "io", "oop": "oop",
    "algorithms": "algo", "modules_libs": "libs", "environment": "libs",
    "data_web": "beyond", "languages": "beyond", "career": "beyond",
}
CONCEPT_EDGE_TYPES = {"prerequisite_of", "is_a", "part_of", "uses_tool", "related_to"}


def main():
    a = json.loads((ROOT / "aggregate" / "aggregate.json").read_text())
    courses = sorted(a["courses"], key=lambda c: ORDER.index(c["id"]) if c["id"] in ORDER else 99)
    data = {
        "courses": [{
            "id": c["id"], "short": SHORT.get(c["id"], c["id"]), "title": c["title"],
            "provider": c.get("provider", ""), "url": c.get("url", ""),
            "format": c.get("format", ""), "audience": c.get("audience", ""),
            "notes": c.get("notes", ""), "sources": c.get("sources", []),
            "retrieved": c.get("retrieved", ""), "modules": c.get("module_count", 0),
        } for c in courses],
        "modules": [{
            "id": m["id"], "c": m["course"], "t": m["title"], "o": m.get("order", 0),
            "url": m.get("url", ""), "topics": m.get("topics", []),
            "projects": m.get("projects", []), "k": m.get("concepts", []),
        } for m in sorted(a["modules"], key=lambda m: (m["course"], m.get("order", 0)))],
        "concepts": [{
            "id": c["id"], "l": c["label"], "cat": c["category"] or "data_web",
            "g": GROUPS.get(c["category"], "beyond"), "cv": c["courses"],
            "canon": c["canonical"], "names": c.get("course_labels", {}),
        } for c in a["concepts"]],
        "edges": [{
            "s": e["source"], "t": e["target"], "ty": e["type"], "c": e["courses"],
        } for e in a["edges"] if e["type"] in CONCEPT_EDGE_TYPES],
    }
    topics_file = ROOT / "topics" / "all_topics.json"
    if topics_file.exists():
        tg = json.loads(topics_file.read_text())
        data["topics"] = [{
            "id": t["id"], "t": t["title"], "c": t["concept"], "s": t["summary"],
            "m": t["minutes"], "core": bool(t.get("core")), "p": t["prerequisites"],
            "k": [[k["title"], k["worked_example"], k["practice"], k["formats"], k["key_prerequisites"]]
                  for k in t["knowledge_points"]],
            "e": [[e["topic"], e["weight"]] for e in t.get("encompasses", [])],
            "ti": t.get("taught_in", []),
        } for t in tg["topics"]]
        data["topicNotes"] = {c: e.get("notes", "") for c, e in tg["concept_map"].items() if e.get("notes")}
    tpl = (ROOT / "explorer_template.html").read_text()
    out = tpl.replace("/*__DATA__*/null", json.dumps(data, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/"))
    (ROOT / "explorer.html").write_text(out)
    print(f"explorer.html: {len(out)//1024} KB, {len(data['concepts'])} concepts, "
          f"{len(data['edges'])} concept edges, {len(data['modules'])} modules")


if __name__ == "__main__":
    main()
