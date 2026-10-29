import argparse
import json
import sys
from pathlib import Path

from app.api import create_app

DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "openapi.json"
DESCRIPTION = "Write the OpenAPI schema to openapi.json, or check that it is up to date."


def render_schema() -> str:
    return json.dumps(create_app().openapi(), indent=2, sort_keys=True) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=DESCRIPTION)
    parser.add_argument("--check", action="store_true", help="fail if the file is outdated")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    output: Path = args.output
    rendered = render_schema()
    if args.check:
        current = output.read_text() if output.exists() else ""
        if current != rendered:
            print(f"{output} is outdated; run `uv run python -m app.openapi_dump`")
            return 1
        return 0
    output.write_text(rendered)
    return 0


if __name__ == "__main__":
    sys.exit(main())
