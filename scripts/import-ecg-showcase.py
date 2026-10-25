"""Freeze the four already-public ECG Library publications for the static site.

Usage: python scripts/import-ecg-showcase.py PATH_TO_CONSPECT_PROJECT
The personal notes database is never opened or copied.
"""

import json
import re
import shutil
import sqlite3
import sys
from pathlib import Path


PUBLICATIONS = {
    "64b88de2-5d7b-4f3c-b2cd-2bb414e7eaac": ("ru", "original"),
    "fb00b28c-422b-431f-b00d-656aabf57751": ("ru", "final"),
    "ccacd1b0-b326-40df-ab16-4134eb4a9643": ("en", "original"),
    "f4af0b0b-8834-4a8c-846e-72dac4d8e3f3": ("en", "final"),
}
NOTE_IDS = {"original": "23", "final": "24"}
ASSETS = {
    "original-ai-ru.pdf",
    "original-ai-en.pdf",
    "technical-requirements-ru.docx",
    "technical-requirements-en.pdf",
}
SITE_ROOT = Path(__file__).resolve().parents[1]


def route(publication_id):
    lang, variant = PUBLICATIONS[publication_id]
    return f"/{lang}/projects/papanda/ecg/{variant}/"


def rewrite_html(html, note_id, block_ids):
    def replace(match):
        target_note, block_id = match.groups()
        if target_note != note_id or block_id not in block_ids:
            raise ValueError(f"Unexpected internal block link: {match.group()}")
        return f'href="#{block_id}"'

    result = re.sub(
        r'href="internal://note/(\d+)/block/([A-Za-z0-9_-]+)"',
        replace,
        html,
    )
    if "internal://" in result:
        raise ValueError("An internal app link remains in published HTML")
    return result


def main(source):
    database = source / "data" / "library.sqlite3"
    if not database.is_file():
        raise FileNotFoundError(database)
    output = SITE_ROOT / "src" / "data" / "ecg-showcase"
    output.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
    try:
        for publication_id, (lang, variant) in PUBLICATIONS.items():
            row = connection.execute(
                "SELECT payload, updated_at FROM publications WHERE id=?", (publication_id,)
            ).fetchone()
            if row is None:
                raise ValueError(f"Missing public publication: {publication_id}")
            payload = json.loads(row[0])
            if payload["language"] != lang:
                raise ValueError(f"Wrong language for {publication_id}")
            block_ids = {block["id"] for block in payload["blocks"]}
            if len(block_ids) != len(payload["blocks"]):
                raise ValueError(f"Duplicate block ID in {publication_id}")
            for block in payload["blocks"]:
                block["html"] = rewrite_html(block.get("html", ""), NOTE_IDS[variant], block_ids)
                for rejected in block.get("rejected_drafts", []):
                    rejected["html"] = rewrite_html(
                        rejected.get("html", ""), NOTE_IDS[variant], block_ids
                    )
            for resource in payload.get("resources", []):
                url = resource["url"]
                if url.startswith("/static/showcase/ecg/"):
                    name = url.rsplit("/", 1)[-1]
                    if name not in ASSETS:
                        raise ValueError(f"Unexpected asset: {name}")
                    resource["url"] = f"/assets/ecg/{name}"
                elif url.startswith("/library/"):
                    resource["url"] = route(url.rsplit("/", 1)[-1])
                else:
                    raise ValueError(f"Unexpected resource URL: {url}")
            payload["sourcePublicationId"] = publication_id
            payload["sourceUpdatedAt"] = row[1]
            target = output / f"{lang}-{variant}.json"
            target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"{target.relative_to(SITE_ROOT)}: {len(payload['blocks'])} blocks")
    finally:
        connection.close()

    source_assets = source / "fastapi_app" / "static" / "showcase" / "ecg"
    target_assets = SITE_ROOT / "public" / "assets" / "ecg"
    target_assets.mkdir(parents=True, exist_ok=True)
    for name in sorted(ASSETS):
        shutil.copy2(source_assets / name, target_assets / name)
        print(f"{(target_assets / name).relative_to(SITE_ROOT)}")

    project_path = SITE_ROOT / "src" / "content" / "projects" / "papanda.json"
    project = json.loads(project_path.read_text(encoding="utf-8"))
    replacements = {
        "body_ru": (
            ("Подробный разбор критики готовится к публикации вместе с исходным конспектом.",
             "Авторские замечания и отвергнутые варианты сохранены в [первоначальном конспекте](/ru/projects/papanda/ecg/original/)."),
            ("Оригинальные конспекты и разбор критики пока не опубликованы на этой странице.",
             "Обе версии конспекта и пояснение к ним доступны в [примере по ЭКГ](/ru/projects/papanda/ecg/)."),
        ),
        "body_en": (
            ("A detailed critique is being prepared for publication alongside the original notes.",
             "The author's comments and rejected drafts are preserved in the [initial annotated notes](/en/projects/papanda/ecg/original/)."),
            ("The original notes and the critique have not yet been published on this page.",
             "Both versions and an introduction are available in the [ECG example](/en/projects/papanda/ecg/)."),
        ),
    }
    for field, pairs in replacements.items():
        for old, new in pairs:
            if old in project[field]:
                project[field] = project[field].replace(old, new)
            elif new not in project[field]:
                raise ValueError(f"Cannot find papanda copy to update: {old}")
    for link in project["exampleLinks"]:
        variant = link["id"].removeprefix("ecg-")
        suffix = "#critique" if variant == "critique" else f"{variant}/"
        for lang in ("ru", "en"):
            link[f"url_{lang}"] = f"/{lang}/projects/papanda/ecg/{suffix}"
    project_path.write_text(json.dumps(project, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{project_path.relative_to(SITE_ROOT)}: example links updated")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]).resolve())
