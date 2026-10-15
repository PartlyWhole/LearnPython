# Reconciliation log

Final pass over topics/B01-B20 (source of truth). One line per change: what, which IDs, why. Every new or rewritten worked example was run with Python 3.13 via scripts/run_snippet.py unless marked "not run". `validate_topics.py --all` was run after each group and ended at 0 errors, 0 warnings; `merge_topics.py` reports no UNRESOLVED lines.

## 1. Pending prerequisites (queue: PENDING list, RESOLVE items for main_guard / lib_pytest / tool_mypy / hash_maps_internals / simulation / rest_api_design)

- `rest_api_design.resources_and_methods`: pending replaced (concept:apis_http is satisfied transitively: apis_http.request_response_cycle becomes a prerequisite of web_development.how_web_apps_work (item 2, HTTP basics))
- `trees.bst_search_and_insert`: pending replaced by prerequisite(s) `binary_search.iterative_binary_search` (BST search is binary search on a tree; most specific binary_search topic)
- `raising_exceptions.custom_exceptions`: pending replaced by prerequisite(s) `classes.define_and_instantiate` (needs the class statement; the (Exception) base stays a memorised template, inheritance proper comes in inheritance.exception_hierarchies)
- `unit_testing.unittest_module`: pending replaced by prerequisite(s) `inheritance.define_subclass` (a TestCase is a subclass with self-methods; define_subclass implies classes.define_methods)
- `inheritance.define_subclass`: pending replaced by prerequisite(s) `classes.define_methods`, `objects_methods.isinstance_checks` (concept:classes + concept:constructors -> classes.define_methods (implies constructors.init_sets_attributes); KP4 uses isinstance, now taught in B11)
- `inheritance.super_init`: pending replaced (concept:constructors is implied via inheritance.define_subclass -> classes.define_methods -> constructors.init_sets_attributes)
- `inheritance.multilevel_hierarchies`: pending replaced by prerequisite(s) `encapsulation.private_by_convention` (KP3 builds on _private/__private names)
- `composition.objects_as_attributes`: pending replaced by prerequisite(s) `classes.methods_change_state`; removed `lists.loop_over_items` (concept:classes + concept:instance_attributes -> classes.methods_change_state (KP2 add() mutates state; implies define_methods/init); lists.loop_over_items is implied by list_methods.append_build)
- `sum_types.variants_as_classes`: pending replaced by prerequisite(s) `enums.define_and_use`, `objects_methods.isinstance_checks`; removed `conditionals.elif_chains` (KP3 contrasts enums; KP2 dispatches with isinstance; elif_chains is implied by isinstance_checks)
- `object_oriented_design.find_classes_in_a_problem`: pending replaced by prerequisite(s) `classes.define_methods` (skeletons need __init__ attributes and methods; define_methods implies instance_attributes/constructors)
- `linked_lists.nodes_and_traversal`: pending replaced by prerequisite(s) `constructors.init_sets_attributes`; removed `while_loops.repeat_while_true` (Node is a class with __init__; while_loops.repeat_while_true dropped to stay at 4 (implied by mutability_aliasing.names_refer_to_objects))
- `trees.binary_tree_nodes`: pending replaced (concept:classes implied via linked_lists.nodes_and_traversal -> constructors.init_sets_attributes)
- `linked_lists.compare_with_python_list`: pending replaced by prerequisite(s) `complexity_big_o.cost_of_builtin_operations`; removed `list_methods.insert_extend` (compares step counts of list operations; insert_extend is implied by cost_of_builtin_operations)
- `balanced_trees.why_balance`: pending replaced (concept:complexity_big_o implied via trees.bst_search_and_insert -> binary_search.iterative_binary_search -> complexity_big_o.complexity_classes)
- `hash_maps_internals.hash_to_index`: pending replaced by prerequisite(s) `complexity_big_o.cost_of_builtin_operations`; removed `arithmetic_operators.modulo_patterns` (queue: O(1) lookup builds on cost_of_builtin_operations; modulo_patterns dropped to stay at 4 (implied by unicode_encoding.ord_and_chr))
- `p_vs_np.verify_vs_solve`: pending replaced by prerequisite(s) `complexity_big_o.complexity_classes` (polynomial vs exponential growth rates)
- `args_kwargs.star_kwargs`: pending replaced by prerequisite(s) `dictionaries.loop_keys_values_items`; removed `parameters_arguments.keyword_arguments` (KP2 loops over the collected dict; keyword_arguments is implied by args_kwargs.star_args)
- `csv_files.dict_reader_writer`: pending replaced by prerequisite(s) `dictionaries.create_and_look_up` (rows are dicts read with row[key] and written as dict literals)
- `json_data.json_strings`: pending replaced by prerequisite(s) `dictionaries.create_and_look_up` (JSON objects load as dicts)
- `json_data.json_pitfalls`: pending replaced by prerequisite(s) `dictionaries.valid_keys_and_tuple_keys`; removed `tuples.create_and_index` (concept:dictionaries resolved; concept:sets dropped by swapping KP3 example from json.dumps({1, 2}) to a tuple-key dict, which also links to valid_keys_and_tuple_keys (implies tuples))
- `file_io.handle_missing_file`: pending replaced by prerequisite(s) `exceptions.try_except_basics` (applies try/except to FileNotFoundError)
- `context_managers.write_with_contextlib`: pending replaced by prerequisite(s) `generators.yield_values`, `exceptions.else_and_finally`; removed `functions.define_and_call` (setup/yield/cleanup needs yield; KP3 needs try/finally; define_and_call implied)
- `context_managers.write_with_contextlib`: now encompasses `exceptions.else_and_finally` (0.3), as B09 asked
- `main_guard.if_name_main`: pending replaced by prerequisite(s) `modules_imports.own_modules`; removed `conditionals.if_statement` (own_modules KP3 (importing runs top-level code) sets up the guard; if_statement implied)
- `lib_pytest.write_and_run_tests`: pending replaced by prerequisite(s) `modules_imports.own_modules`, `tool_pip.pip_install` (test files import the code under test; pip install pytest is no longer a memorised line)
- `lib_pytest.raises_and_test_folders`: added prerequisite `modules_imports.packages_and_import_errors` (tests/ folder with __init__.py; queue RESOLVE)
- `tool_mypy.check_hints_with_mypy`: added prerequisite `tool_pip.pip_install` (mypy is installed with pip); removed `type_hints.annotate_functions` (implied by optional_and_union)
- `recursion.nested_lists`: pending replaced by prerequisite(s) `objects_methods.isinstance_checks`, `nested_data_structures.grid_index_and_loop`; removed `data_types.values_have_types`, `list_methods.insert_extend` (lists of lists -> grid_index_and_loop; type(x) == list switched to isinstance (queue DONE item); values_have_types and insert_extend are implied by isinstance_checks)
- `json_data.navigate_nested_json`: pending replaced by prerequisite(s) `nested_data_structures.navigate_deep_data`; removed `lists.loop_over_items`, `list_methods.append_build` (B07 asked JSON to depend on navigate_deep_data; the two list prerequisites are implied by it)
- `simulation_monte_carlo.estimate_probability`: pending replaced by prerequisite(s) `random_module.random_numbers` (randint and seed; random_numbers owns randint)
- `simulation_monte_carlo.estimate_area_pi`: pending replaced (concept:random_module implied via estimate_probability)
- `for_loops.loop_over_characters`: pending replaced by prerequisite(s) `strings.length_and_membership`; removed `conditionals.if_statement` (B03 asked for_loops to build on length_and_membership; it implies strings.literals_and_quotes; if_statement implied by using_the_loop_variable)
- Kept some already-implied prerequisites (`json_data.json_pitfalls` -> `tuples.create_and_index`, `json_data.navigate_nested_json` -> `lists.loop_over_items`/`list_methods.append_build`, `context_managers.write_with_contextlib` -> `functions.define_and_call`) because the validator only follows ancestry through earlier waves, so key prerequisites reached through a same-wave topic would warn
- `recursion.nested_lists`: kept `list_methods.insert_extend` (KP3 extend vs append), dropped `builtin_functions.sum_max_min`; KP4 rewritten to the largest-so-far pattern instead of max(a, b) (re-run: prints 3)

## 2. Duplicates (queue: DUPLICATE return values, DUPLICATE mutable default, CHECK generator expressions x2, CHECK missing file, CHECK math.isclose, RESOLVE HTTP basics)

- Removed `unpacking.return_multiple_values` (B06), a duplicate of `return_values.multiple_return_values` (B05 owns returning several values). Replaced it with the dependent topic `unpacking.use_returned_tuples` (index, `_`, collecting results, same-shape returns), prerequisites `return_values.multiple_return_values`, `unpacking.unpack_in_loops`, `return_values.early_return`; snippets run with 3.13. Only reference was the B06 concept_map, updated
- `mutability_aliasing.lists_in_functions`: removed KP4 (mutable default arguments, duplicate of `parameters_arguments.mutable_default_trap`, which B05 owns); summary updated, minutes 18 -> 16; pending concept:parameters_arguments resolved to `return_values.return_a_value` (KP3 returns a new list; implies one_parameter)
- `parameters_arguments.mutable_default_trap`: pending concept:lists + concept:mutability_aliasing resolved to `mutability_aliasing.lists_in_functions` (aliasing a list parameter is exactly what the trap builds on); `return_values.return_a_value` dropped (implied); now encompasses lists_in_functions (0.4)
- `list_comprehensions.any_all_and_sum`: removed KP4 (generator-expression preview); B08 `generators.generator_expressions` owns generator expressions. minutes 16 -> 15
- `generators.generator_expressions`: pending concept:list_comprehensions resolved to `list_comprehensions.any_all_and_sum` (replaces `builtin_functions.sum_max_min`, implied by it); KP2 rewritten as "drop the brackets of a comprehension inside a call" (re-run with 3.13); encompasses any_all_and_sum (0.5) as B07 asked
- Missing-file handling (B09 vs B10): no duplicate found. B09 has no FileNotFoundError example (its exceptions note hands it to B10); `file_io.handle_missing_file` stays the owner and now depends on `exceptions.try_except_basics`. `file_io.open_and_read` KP only shows the error, which is the intended preview
- math.isclose (B13 vs B14): no duplicated KP (B14 only mentions it in notes). `floating_point_precision.decimal_and_fraction` now depends on `math_module.isclose_and_inf` (replacing implied `type_conversion.strings_to_numbers`), encompasses it (0.2), and KP1 contrasts isclose with exact Decimal ==
- HTTP basics (B16 vs B17): `apis_http.request_response_cycle` owns requests/responses, methods and status codes. Made it a prerequisite of `web_development.how_web_apps_work` (KP1 reframed as the server side of the cycle, KP3 no longer re-lists status codes; encompasses 0.2) and therefore of `rest_api_design.resources_and_methods` (KP2/KP3 key prerequisites + encompassing 0.3; KP3 retitled to choosing codes for your own API's outcomes)

## 3. Gaps (queue: GAP sum/max/min/len, GAP collection type hints, GAP + PARTIAL dispatch tables, CHECK B09 parametrize)

- Added `lists.aggregate_builtins` (B06, core, 15 min): len/sum/max/min of a list, average, empty-list guard, lists of strings. Prerequisites `lists.loop_over_items`, `builtin_functions.sum_max_min`, `comparison_operators.compare_mixed_types` (KP4 string ordering); snippets run with 3.13
- `nested_data_structures.rows_columns_diagonals`: prerequisite `builtin_functions.sum_max_min` replaced by `lists.aggregate_builtins` (it applies these built-ins to lists; implies sum_max_min)
- `nested_data_structures.dict_of_lists_and_dicts`: prerequisite `builtin_functions.sum_max_min` replaced by `lists.aggregate_builtins` (it applies these built-ins to lists; implies sum_max_min)
- `list_comprehensions.any_all_and_sum`: prerequisite `builtin_functions.sum_max_min` replaced by `lists.aggregate_builtins` (it applies these built-ins to lists; implies sum_max_min)
- `higher_order_functions.custom_key_functions`: prerequisite `builtin_functions.sum_max_min` replaced by `lists.aggregate_builtins` (it applies these built-ins to lists; implies sum_max_min)
- `functional_programming.loops_to_pipelines`: prerequisite `builtin_functions.sum_max_min` replaced by `lists.aggregate_builtins` (it applies these built-ins to lists; implies sum_max_min)
- `statistics_module.mean_median_mode`: prerequisite `builtin_functions.sum_max_min` replaced by `lists.aggregate_builtins` (it applies these built-ins to lists; implies sum_max_min) ; dropped implied `lists.create_and_index`
- `lib_numpy.vectorised_arithmetic`: prerequisite `builtin_functions.sum_max_min` replaced by `lists.aggregate_builtins` (it applies these built-ins to lists; implies sum_max_min)
- Added `type_hints.collection_hints` (B05, non-core, 15 min): list[str], dict[str, float], tuple[str, str] / list[tuple[...]], hints not checked at run time. Prerequisites `type_hints.annotate_functions`, `dictionaries.create_and_look_up`, `tuples.lists_of_tuples`; snippets run with 3.13
- `tool_mypy.check_hints_with_mypy`: added prerequisite `type_hints.collection_hints` (KP3 uses list[str])
- `lib_sqlalchemy.relationships`: added prerequisite `type_hints.collection_hints` (KP2 uses Mapped[list["Post"]])
- Added `higher_order_functions.dispatch_tables` (B08, core, 16 min): functions as dict values, calculator from input, replacing an elif chain with get + default, same-signature and stored-call bugs. Prerequisites `higher_order_functions.functions_are_values`, `dictionaries.membership_and_get`; snippets run with 3.13
- `cli_applications.command_loop`: added prerequisite `higher_order_functions.dispatch_tables`; KP2 now dispatches through a dict of functions (B10 had deferred this to B08) and encompasses dispatch_tables (0.4)
- `function_calling.dispatch_tool_calls`: prerequisite `higher_order_functions.functions_are_values` replaced by `higher_order_functions.dispatch_tables` (KP1 is a dispatch table keyed by tool name; encompassing moved too)
- `event_driven_programming.callbacks_and_registration`: prerequisite `dictionaries.membership_and_get` replaced by `higher_order_functions.dispatch_tables` (a handler registry is a dispatch table; implies membership_and_get); encompasses it (0.3)
- `web_development.how_web_apps_work`: routing table (KP2/KP3) now builds on `higher_order_functions.dispatch_tables`, replacing `functions_are_values` and `dictionaries.membership_and_get` (both implied); encompasses dispatch_tables (0.4)
- `function_calling.dispatch_tool_calls` (B20 PARTIAL item) keeps its tool-specific KPs; the general topic is now its prerequisite
- `lib_pytest.raises_and_test_folders`: added KP4 `@pytest.mark.parametrize` (B09 left parametrize to the stitching pass; not run, pytest not installed) and prerequisite `decorators.at_syntax`; minutes 15 -> 18

## 4. Core promotion (queue: POLICY)

- `nested_loops.grids_and_patterns` -> core (B04 kept it non-core only because print_output.sep_and_end was non-core)
- `loop_patterns.fencepost` -> core (B04 kept it non-core only because print_output.sep_and_end was non-core)
- `iteration.iter_and_next` -> core (restored: B08 asked for it so generators can be core)
- `generators.yield_values` -> core (B08 note: good core candidate once iteration is core)
- `generators.generator_expressions` -> core (B08 note: good core candidate once iteration is core; owner of generator expressions)
- `args_kwargs.unpack_in_calls`: added prerequisite `unpacking.star_unpacking` (B08 had re-taught f(*seq) from scratch and used a non_ancestor encompassing to avoid the non-core link); KP1 now builds on print(*nums)
- `constructors.defaults_and_derived`: prerequisite `mutability_aliasing.names_refer_to_objects` replaced by `parameters_arguments.mutable_default_trap` (implies it); KP4 (mutable default in __init__) now builds on the trap; encompassing no longer non_ancestor (0.4)
- `objects_methods.object_references`: added prerequisite `copying.shallow_vs_deep` (KP3 [obj] * 3 is the object version of the [[0] * 3] * 3 trap taught there)
- `list_comprehensions.nested_comprehensions`: added prerequisite `copying.shallow_vs_deep` (KP2 safe grid building revisits its [[0] * 3] * 3 trap, as the B07 note says)
- `strings.multiline_and_raw`: added prerequisite `print_output.newlines_and_tabs` (raw strings are about keeping \n-style escapes literal; B03 had used a non_ancestor encompassing because the topic was non-core)
- `class_attributes.classmethods`: added prerequisite `decorators.at_syntax` (@classmethod had been a memorised marker to avoid a cross-batch link); dropped implied `string_methods.split_into_parts`
- `print_output.newlines_and_tabs` -> core (prerequisite of core `strings.multiline_and_raw`; downward closure)
- `print_output.sep_and_end` -> core (prerequisite of core `nested_loops.grids_and_patterns`; downward closure)
- `unpacking.star_unpacking` -> core (prerequisite of core `args_kwargs.unpack_in_calls`; downward closure)
- `parameters_arguments.mutable_default_trap` -> core (prerequisite of core `constructors.defaults_and_derived`; downward closure)
- `copying.shallow_vs_deep` -> core (prerequisite of core `objects_methods.object_references`; downward closure)

## 5a. CHECK: B04 match_statement snippets

- Ran every worked example of `match_statement.match_literals` and `match_statement.capture_and_guards` with Python 3.13 (each subject value checked): all stated outputs were correct, nothing wrong to fix
- Made the fragments self-contained: added `code = 404`, `answer = 'yes'`, `n = -3`, `colour = 'green'` subject lines plus output comments (match_literals KP2-3, capture_and_guards KP2-3); capture_and_guards KP3 now quotes the exact error `SyntaxError: name capture 'RED' makes remaining patterns unreachable`; concept note no longer says "not run"

## 5b. CHECK: incidental prerequisites in B08

- `higher_order_functions.map_and_filter`: dropped `builtin_functions.sum_max_min` (only used for sum(map(abs, ...)) in KP4); KP4 now parses with map and filters with is_even (re-run). 4 -> 3 prerequisites
- `args_kwargs.star_args`: dropped `string_methods.join_pieces` (only used for sep.join in KP4); KP4 example rewritten without join (re-run). 4 -> 3 prerequisites
- `closures.function_factories`: dropped `higher_order_functions.functions_are_values` (implied by lambda_functions.write_lambda; KP1 key prerequisite and encompassing still valid). 4 -> 3
- `recursion.recursion_on_sequences`: dropped `string_indexing_slicing.slice_start_stop` (implied by list_slicing.slice_lists, which builds on string slicing). 4 -> 3
- `args_kwargs.keyword_only_and_positional_only`: dropped `parameters_arguments.keyword_arguments` (implied by args_kwargs.star_args)
- `args_kwargs.star_kwargs`: `parameters_arguments.keyword_arguments` dropped in item 1 (implied by star_args); `generators.generator_expressions`: `builtin_functions.sum_max_min` dropped in item 2
- Kept as is: `higher_order_functions.custom_key_functions` (3 prerequisites, all used), `recursion.nested_lists` (4, each used by a KP after item 1), `decorators.*` (no incidental links found)
- `ai_agents.run_code_tool`: added prerequisite `string_methods.join_pieces` (KP3 uses "\n".join; it had been reachable only through the incidental star_args -> join_pieces edge removed above)

## 5c. Other CHECK / RESOLVE / REVIEW / NOTE items

- `recursion.memoize_with_cache`: added KP4 "Memoising by hand with a dict" (B08 left hand-written memoisation to the stitching pass; MIT teaches it) and prerequisite `dictionaries.membership_and_get`; minutes 14 -> 17; snippet run with 3.13
- `llm_apis.chat_request_messages`: added prerequisite `apis_http.request_response_cycle` (KP4: the request body is POSTed as JSON); dropped implied `list_methods.append_build`
- REVIEW B20 markdown + static_site_generation: not deleted; added a notes remark to both concept_map entries and to all 15 topics that they form one guided project best delivered as multisteps
- CHECK `for_loops.loop_over_characters` vs B03: B03 has no string-traversal topic (its note hands traversal to B04); pending resolved to `strings.length_and_membership` (item 1) and encompassed (0.2) as B03 asked
- CHECK early `import csv/json/os/copy`: B13 already does this: `modules_imports.import_module` KP3 and `from_import_and_alias` KP2 practise those lines and encompass `copying.shallow_vs_deep`, `json_data.json_strings`, `collections_module.counter` (non_ancestor). No backward prerequisites added (NOTE item)
- CHECK B09 handoffs: KeyError is taught in B07 (`dictionaries.create_and_look_up` KP4, `add_update_delete` KP2-3); FileNotFoundError in B10 (`file_io.open_and_read`, `file_io.handle_missing_file`); parametrize was missing and was added to `lib_pytest.raises_and_test_folders` (item 3)
- RESOLVE B15 hash_maps_internals and B14 simulation: done in item 1 (`complexity_big_o.cost_of_builtin_operations`, `random_module.random_numbers`)
- RESOLVE main_guard / lib_pytest / tool_pip: done in item 1 (`modules_imports.own_modules`, `modules_imports.packages_and_import_errors`, `tool_pip.pip_install` for lib_pytest and tool_mypy)
- RESOLVE rest_api_design / web_development: done in items 1-2 (`apis_http.request_response_cycle` is a prerequisite of `web_development.how_web_apps_work`, overlapping KPs reframed)

## 5d. CHECK: B15 long worked examples

- Trimmed to the changed lines (all re-run with 3.13 with the shared definitions prepended): `linked_lists.add_head_and_tail` KP3 (28 -> 25 lines), `linked_lists.remove_nodes` KP3 (20 -> 17, build lines replaced by a comment), `linked_lists.reverse_in_place` KP2-3 (17/16 -> 14/13), `trees.bst_delete_and_sorted_order` KP2 (21 -> 21, but the odd `delete(insert(root, v), 100)` build loop replaced by plain inserts), `graph_algorithms.connected_components` KP2-3, `graph_algorithms.shortest_path_bfs` KP1 and KP4 (24 -> 21)
- `linked_lists.reverse_in_place` (cut candidate) kept: nothing duplicates it, it is the classic pointer-rewiring exercise, and it is non-core with no dependents, so it costs nothing on the core path
- Not trimmed: the remaining 15-18 line examples (tries, DFS/BFS, collisions) are complete algorithms within the skill's 10-14 line allowance plus setup and explanation; shortening them further would hide the algorithm

## 6. Final scan (near-duplicates and missing ancestors the queue did not list)

- `list_comprehensions.map_each_item`: added prerequisite `lists.aggregate_builtins` (KP4 prints sum(nums) of the list it builds; found by scanning examples for built-ins with no matching ancestor)
- `functional_programming.reduce`: added prerequisite `string_methods.join_pieces` (KP4 compares reduce with "-".join(...))
- `trees.recursive_tree_functions`: added prerequisite `builtin_functions.sum_max_min` (KP2-3 use max() of several values)
- `bisection_method.robust_bisection`: added prerequisite `builtin_functions.sum_max_min` (KP1-3 use max(1.0, x) / min(x, -1.0) for the search range)
- `graphics_canvas.colors_and_random_colors`: added prerequisite `builtin_functions.sum_max_min`, removed implied `random_module.random_numbers` (KP2/KP4 clamp with min()/max(); random_numbers is implied by choice_shuffle_sample)
- `game_development.game_objects_as_classes`: added prerequisite `builtin_functions.sum_max_min` (KP2 keeps a high score with max(a, b))
- `dunder_methods.custom_iterators`: added prerequisite `builtin_functions.sum_max_min` (KP2 shows sum() consuming a custom iterator)
- Not changed: `p_vs_np.verify_vs_solve` uses sum() on a tuple but already has 4 direct prerequisites, none implied; sum() is a deep core skill every learner reaching P vs NP has seen, so no slot was spent on it
- Near-duplicate: `json_data.navigate_nested_json` (B10) re-taught `nested_data_structures.navigate_deep_data` (B07): path reading, looping over the reached list, which-step-failed errors. Kept the B07 topic as owner; rewrote the B10 topic as a dependent (parse then path, collect fields, JSON null -> None, exploring an unfamiliar response), encompassing navigate_deep_data (0.4); minutes 18 -> 17; snippets run with 3.13. All 5 dependents (apis_http, tool_geocoding_api, llm_apis) keep their links
- Near-duplicate: `object_oriented_design.refactor_procedural_to_class` (B12) KP1-2 repeated `classes.records_as_classes` (B11) KP1-2 (dict record -> class, function -> method). Made records_as_classes a prerequisite (replacing implied `dictionaries.create_and_look_up`) and an encompassed topic (0.4); KP2 reframed as applying that move to a whole program. KP3 (globals) and KP4 (behaviour check) are unique and stay
- Near-duplicate: `composition.shared_parts_and_aliasing` (B12) KP1 "two containers, one object" overlapped `objects_methods.object_references` (B11) "two names, one object"; B11 and B12 ran in parallel. Added object_references as prerequisite and encompassed topic (0.4, replacing the names_refer_to_objects encompassing); the KP stays as the composition-specific case
- Checked and left as intended ladders (no change): logical_operators.and_or_not -> conditionals.compound_conditions; while_loops.input_validation -> defensive_programming.get_int_helper; loop_patterns.search_flag -> list_comprehensions.any_all_and_sum; dictionaries.build_from_pairs -> dict_comprehensions.build_dicts; guess_and_check -> bisection -> newton (shared code by design); composition.has_a_vs_is_a vs object_oriented_design.collaborating_objects (different skills); sql_joins.inner_join vs lib_pandas.merge_tables (different tools)

## Stats

| | before | after |
|---|---|---|
| Topics | 626 | 629 |
| Core topics | 287 | 299 |
| Minutes (all) | 10,268 (171 h) | 10,317 (172 h) |
| Minutes (core) | 4,685 | 4,870 |
| Knowledge points | 2,401 | 2,414 |
| Prerequisite edges | 1,522 | 1,564 |
| Encompassing edges | 1,199 | 1,214 |
| pending_prerequisites entries | 40 | 0 |
| Validator (--all) | 0 errors, 0 warnings, 21 PENDING concepts | 0 errors, 0 warnings, no PENDING |

Topic count: +3 new (`lists.aggregate_builtins`, `type_hints.collection_hints`, `higher_order_functions.dispatch_tables`); `unpacking.return_multiple_values` was replaced in place by `unpacking.use_returned_tuples` (net 0). Core: +10 promoted (sep_and_end, newlines_and_tabs, grids_and_patterns, fencepost, iter_and_next, yield_values, generator_expressions, star_unpacking, mutable_default_trap, shallow_vs_deep) and +2 new core topics. The core set is downward closed: no core topic has a non-core prerequisite.

## Decided not to change

- `linked_lists.reverse_in_place`: kept (see 5d). It is non-core with no dependents and does not overlap another topic.
- B20 markdown / static_site_generation: kept all 15 topics as asked; only notes added (see 5c).
- RESOLVE `lib_flask` contact-form email -> `lib_smtplib.email_messages_and_templates`: no B17 topic sends email (no contact-form KP exists), so a prerequisite would link to content nobody uses; adding an email KP to Flask would pull the whole networking chain into the Flask track. Left for a project/multistep that combines both.
- NOTE memorised imports in earlier waves: left memorised, no backward prerequisites (B13 already practises and encompasses them).
- NOTE B16 all non-core: kept non-core; the new `apis_http.request_response_cycle` links from B17/B20 are all to non-core topics, so no network topic entered the core.
- Many already-implied ("redundant") direct prerequisites remain (about 170 before this pass). They were only removed where a slot was needed or the queue flagged them; the validator only follows ancestry through earlier waves, so some same-wave redundant links are what keeps key prerequisites checkable.
- Cross-wave links added by this pass (e.g. B05 `type_hints.collection_hints` -> B07 dictionaries, B08 `recursion.nested_lists` -> B11 `objects_methods.isinstance_checks`, B09 `custom_exceptions`/`unittest_module` -> B11/B12) point from an earlier batch file to a later one. That is valid for the merged graph (validated with --all, 0 errors) but single-batch runs such as `validate_topics.py . B05` now report ERRORs for these forward links (B05: 8, B06: 10, B08: 16, B09: 11). This is inherent to resolving pending prerequisites, which by definition point to later waves; `--all` is the check that applies after reconciliation.
- `p_vs_np.verify_vs_solve` uses sum() without it as an ancestor; it already has 4 non-implied prerequisites (see 6).
- Pre-existing uses of `os.path.join` / `b"".join` flagged by the ancestor scan are not str.join and need no link.
- B15 examples of 15-18 lines that are complete algorithms (DFS/BFS, tries, collisions) were not shortened further.
