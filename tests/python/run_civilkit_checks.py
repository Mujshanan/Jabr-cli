#!/usr/bin/env python3
"""Independent smoke checks for the Jabr vendored Calcpad native runner.

This runner intentionally uses only the Python standard library. It launches the
same pinned Jabr engine used by Jabr's native build script and checks a small,
deterministic worksheet corpus against Python-computed expected values.

Run from the repository root:
    python tests/python/run_civilkit_checks.py

The CLI must already be built with:
    npm run engine:native
or:
    bun run engine:native:bun
"""

from __future__ import annotations

import html
import json
import math
import os
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "engine"
TARGET = ENGINE / "target" / "release"
CLI = TARGET / ("jabr-engine.exe" if os.name == "nt" else "jabr-engine")


class ReportText(HTMLParser):
    """Collect visible text from the generated HTML report."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if text:
            self.parts.append(text)

    @property
    def text(self) -> str:
        return " ".join(self.parts)


def run_cli(source: str, output: Path) -> str:
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", suffix=".cpd", delete=False
    ) as worksheet:
        worksheet.write(source)
        worksheet_path = Path(worksheet.name)

    try:
        completed = subprocess.run(
            [str(CLI), str(worksheet_path), str(output), "-b", "-s"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if completed.returncode != 0:
            raise RuntimeError(
                "Jabr engine failed ("
                + str(completed.returncode)
                + "):\n"
                + completed.stdout
                + completed.stderr
            )
        if not output.is_file():
            raise RuntimeError("Jabr engine did not create the requested HTML report.")
        return output.read_text(encoding="utf-8", errors="replace")
    finally:
        worksheet_path.unlink(missing_ok=True)


def check_case(name: str, source: str, expected: float, report_path: Path) -> dict:
    raw_html = run_cli(source, report_path)
    parser = ReportText()
    parser.feed(raw_html)
    visible = html.unescape(parser.text)

    # The CLI report is the current observable result surface. The expected value
    # is calculated independently below, not by parsing the engine's own expression.
    if not math.isfinite(expected):
        raise AssertionError(f"{name}: test expectation must be finite")
    if not any(token in visible for token in (str(expected), f"{expected:g}")):
        raise AssertionError(
            f"{name}: expected result {expected:g} was not visible in the report. "
            f"Visible report text: {visible[:1200]}"
        )
    if "<html" not in raw_html.lower():
        raise AssertionError(f"{name}: output is not an HTML report")

    return {
        "name": name,
        "expected": expected,
        "report_contains_expected": True,
        "html_bytes": len(raw_html.encode("utf-8")),
    }


def main() -> int:
    if not CLI.is_file():
        print(
            "Jabr engine runner not found. Build it first with "
            "'npm run engine:native' or 'bun run engine:native:bun'.",
            file=sys.stderr,
        )
        return 2

    cases: Iterable[tuple[str, str, float]] = (
        (
            "scalar arithmetic",
            "answer = 6*7\n",
            6 * 7,
        ),
        (
            "variable evaluation",
            "a = 6\nb = 7\nanswer = a*b\n",
            6 * 7,
        ),
        (
            "operator precedence",
            "answer = 2 + 3*4\n",
            2 + 3 * 4,
        ),
    )

    results = []
    with tempfile.TemporaryDirectory(prefix="jabr-python-checks-") as temp:
        temp_dir = Path(temp)
        for index, (name, source, expected) in enumerate(cases, start=1):
            result = check_case(
                name,
                source,
                expected,
                temp_dir / f"case-{index}.html",
            )
            results.append(result)
            print(f"PASS  {name}: expected {expected:g}")

    print(json.dumps({"passed": len(results), "results": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
