// The play order (lessons/index.json, format 2), expanded into levels. Pure: no DOM, no fetch.
// An item is a plain level ({"level": id}) or a lesson ({"lesson": id}), which expands to its
// guided level, its practice levels, then its twist. tools/play_order.py does the same in Python.

/** A lesson's levels in play order. */
export function lessonLevels(lesson) {
  return [lesson.guided.level, ...(lesson.practice ?? []), ...(lesson.twist ? [lesson.twist] : [])];
}

/**
 * @param index   lessons/index.json ({format: 2, units: [{id, title, items}]})
 * @param lessons {id: lesson} for every lesson the index names
 * @returns {{units: Array<{id, title, items}>, items: Array, levels: string[]}}
 *   each item: {lesson: id | null, levels, guided, practice, twist} (a plain level has guided = its id)
 */
export function playOrder(index, lessons) {
  const units = index.units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    items: unit.items.map((item) => {
      if (item.lesson) {
        const lesson = lessons[item.lesson];
        if (!lesson) throw new Error(`lessons/index.json names a missing lesson: ${item.lesson}`);
        return { lesson: lesson.id, levels: lessonLevels(lesson), guided: lesson.guided.level,
                 practice: lesson.practice ?? [], twist: lesson.twist ?? null };
      }
      return { lesson: null, levels: [item.level], guided: item.level, practice: [], twist: null };
    }),
  }));
  const items = units.flatMap((u) => u.items);
  return { units, items, levels: items.flatMap((i) => i.levels) };
}

/** The ids of the lessons the index names, in order (to fetch them). */
export function lessonIds(index) {
  return index.units.flatMap((u) => u.items.filter((i) => i.lesson).map((i) => i.lesson));
}
