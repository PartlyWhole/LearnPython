#!/usr/bin/env python3
"""Run a worked-example snippet and show exactly what it prints, including any error.

Usage (code on stdin; optional canned answers for input() as arguments):
  printf 'name = input("Name? ")\\nprint("Hi", name)\\n' | PY312 run_snippet.py Ana
where PY312 is the interpreter named in SKILL.md (Python 3.12+).

input() is replaced by a stub that echoes the prompt plus the canned answer, as a terminal
would show it. On an exception the last traceback line is printed, which is the line worth
quoting in a worked example ("# TypeError: ...").
"""
import builtins
import sys
import traceback

answers = list(sys.argv[1:])


def fake_input(prompt=""):
    value = answers.pop(0) if answers else ""
    print(f"{prompt}{value}")
    return value


builtins.input = fake_input
code = sys.stdin.read()
try:
    exec(compile(code, "<snippet>", "exec"), {"__name__": "__main__"})
except SystemExit:
    pass
except BaseException:  # noqa: BLE001 - we want to show any error the learner would see
    print(traceback.format_exc().strip().splitlines()[-1])
