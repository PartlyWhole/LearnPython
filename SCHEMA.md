# Course Knowledge Graph Schema

Every course graph lives at `courses/<course_id>.json` and follows this shape so all
graphs can be merged into one aggregate graph by concept `id`.

```json
{
  "course": {
    "id": "helsinki_mooc",
    "title": "Python Programming MOOC 2025",
    "provider": "University of Helsinki",
    "url": "https://programming-25.mooc.fi/",
    "format": "self-paced, 14 parts",
    "audience": "absolute beginners",
    "sources": ["https://...", "https://..."],
    "retrieved": "2026-10-12",
    "notes": "version/year caveats, anything uncertain"
  },
  "modules": [
    {
      "id": "helsinki_mooc:part01",
      "title": "Part 1: Getting started with programming",
      "order": 1,
      "url": "https://...",
      "topics": ["Original sub-section titles, verbatim-ish, as listed by the course"],
      "projects": ["Named problem sets / projects in this module, if any"],
      "concepts": ["print_output", "variables", "..."]
    }
  ],
  "concepts": [
    {
      "id": "variables",
      "label": "Variables & assignment",
      "category": "fundamentals",
      "first_module": "helsinki_mooc:part01",
      "depth": "introduced | practiced | deep",
      "course_label": "How this course names it (optional)"
    }
  ],
  "edges": [
    { "source": "variables", "target": "conditionals", "type": "prerequisite_of" },
    { "source": "dictionaries", "target": "collections", "type": "is_a" },
    { "source": "recursion", "target": "functions", "type": "requires" },
    { "source": "helsinki_mooc:part01", "target": "helsinki_mooc:part02", "type": "precedes" }
  ]
}
```

## Rules

1. **Concept IDs** — use an ID from `CONCEPTS.md` whenever one fits. Only invent a new
   ID if nothing fits; new IDs are `snake_case`, generic (not course-branded), and the
   concept gets `"new": true` so the aggregator can review it.
2. **Module → concept** links are carried by `modules[].concepts`; don't duplicate them as edges.
3. **Edge types**:
   - `prerequisite_of` — concept A is taught before and needed for concept B *in this course*
   - `requires` — inverse phrasing allowed, but prefer `prerequisite_of`
   - `is_a` — taxonomy (e.g. `dictionaries is_a collections`)
   - `part_of` — component (e.g. `list_slicing part_of lists`)
   - `related_to` — weak association
   - `precedes` — module ordering
   - `uses_tool` — concept/module uses a tool or library (e.g. `web_scraping uses_tool lib_beautifulsoup`)
4. **Libraries/tools** use the `lib_` / `tool_` prefixes (e.g. `lib_requests`, `tool_git`).
5. **depth**: `introduced` (mentioned/briefly used), `practiced` (exercises), `deep` (major focus).
6. Be faithful to the actual published syllabus; record uncertainty in `course.notes`.
