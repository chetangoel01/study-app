#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import shutil
import subprocess
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


REPO_ROOT = _repo_root()
BUILD_STUDY_DATA = REPO_ROOT / "build_study_data.py"


def _load_modules() -> list[dict]:
    spec = importlib.util.spec_from_file_location("build_study_data", BUILD_STUDY_DATA)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {BUILD_STUDY_DATA}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    public = list(module.MODULES)
    pipeline_only = list(getattr(module, "PIPELINE_ONLY_MODULES", []))
    dynamic_loader = getattr(module, "load_dynamic_pipeline_only_modules", None)
    if callable(dynamic_loader):
        pipeline_only.extend(dynamic_loader())
    return public + pipeline_only


def _safe_repo_dir_name(repo_url: str) -> str:
    """
    Turn a GitHub repo URL into a stable folder name.
    Examples:
      https://github.com/org/name -> org__name
      https://github.com/org/name.git -> org__name
    """
    m = re.search(r"github\.com/([^/]+)/([^/#?]+)", repo_url)
    if not m:
        return "github_repo"
    owner, name = m.group(1), m.group(2)
    if name.endswith(".git"):
        name = name[:-4]
    return f"{owner}__{name}"


def _normalize_repo_git_url(repo_url: str) -> str:
    return repo_url if repo_url.endswith(".git") else repo_url + ".git"


def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def _read_text_best_effort(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="replace")


def _iter_markdown_files(root: Path, *, exts: set[str], ignore_dirnames: set[str]) -> Iterable[Path]:
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in exts:
            continue
        parts = set(p.parts)
        if parts & ignore_dirnames:
            continue
        if ".git" in p.parts:
            continue
        yield p


@dataclass(frozen=True)
class RepoResult:
    repo_url: str
    clone_dir: Path
    output_dir: Path
    head_sha: str | None
    markdown_files: int
    exported_files: int
    skipped_too_large: int


def clone_and_export_repo_markdown(
    repo_url: str,
    *,
    clone_root: Path,
    output_root: Path,
    ref: str | None,
    exts: set[str],
    ignore_dirnames: set[str],
    max_file_bytes: int,
    reclone: bool,
) -> RepoResult:
    clone_root.mkdir(parents=True, exist_ok=True)
    output_root.mkdir(parents=True, exist_ok=True)

    repo_name = _safe_repo_dir_name(repo_url)
    clone_dir = clone_root / repo_name
    out_dir = output_root / repo_name

    if reclone and clone_dir.exists():
        shutil.rmtree(clone_dir)

    if not clone_dir.exists():
        git_url = _normalize_repo_git_url(repo_url)
        _run(["git", "clone", "--depth", "1", git_url, str(clone_dir)])

    if ref:
        _run(["git", "-C", str(clone_dir), "fetch", "--depth", "1", "origin", ref])
        _run(["git", "-C", str(clone_dir), "checkout", "--force", "FETCH_HEAD"])

    head_sha = None
    try:
        head_sha = subprocess.check_output(["git", "-C", str(clone_dir), "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        head_sha = None

    md_files = list(_iter_markdown_files(clone_dir, exts=exts, ignore_dirnames=ignore_dirnames))
    md_files.sort(key=lambda p: str(p).lower())

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    exported = 0
    skipped_large = 0
    for src in md_files:
        try:
            size = src.stat().st_size
        except OSError:
            continue
        if size > max_file_bytes:
            skipped_large += 1
            continue
        rel = src.relative_to(clone_dir)
        dst = out_dir / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(_read_text_best_effort(src), encoding="utf-8")
        exported += 1

    return RepoResult(
        repo_url=repo_url,
        clone_dir=clone_dir,
        output_dir=out_dir,
        head_sha=head_sha,
        markdown_files=len(md_files),
        exported_files=exported,
        skipped_too_large=skipped_large,
    )


def _unique_github_repo_urls(modules: list[dict]) -> list[str]:
    # Preserve curriculum order; first occurrence wins.
    unique: OrderedDict[str, None] = OrderedDict()
    for m in modules:
        for r in m.get("resources") or []:
            url = str(r.get("url") or "").strip()
            if not url:
                continue
            unique.setdefault(url, None)

    # Local import (pipeline is not a python package).
    import sys

    pipeline_dir = REPO_ROOT / "pipeline"
    if str(pipeline_dir) not in sys.path:
        sys.path.insert(0, str(pipeline_dir))
    from url_classifier import UrlType, classify  # type: ignore
    from config import pipeline_url_excluded_from_stage1_seeds  # type: ignore

    keep: list[str] = []
    for url in unique.keys():
        if pipeline_url_excluded_from_stage1_seeds(url):
            continue
        if classify(url) == UrlType.GITHUB_REPO:
            keep.append(url)
    return keep


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Clone GitHub repo sources from build_study_data and export all markdown files."
    )
    parser.add_argument(
        "--out",
        default=str(REPO_ROOT / "output" / "github-repo-markdown"),
        help="Output folder for exported markdown (default: output/github-repo-markdown/)",
    )
    parser.add_argument(
        "--clone-cache",
        default=str(REPO_ROOT / "pipeline" / ".cache" / "repo-markdown-clones"),
        help="Clone cache folder (default: pipeline/.cache/repo-markdown-clones/)",
    )
    parser.add_argument(
        "--ref",
        default=None,
        help="Optional git ref to checkout for all repos (branch/tag/sha). Default: repo default branch.",
    )
    parser.add_argument(
        "--max-file-kb",
        type=int,
        default=512,
        help="Skip markdown files larger than this (default: 512KB).",
    )
    parser.add_argument(
        "--reclone",
        action="store_true",
        help="Delete existing clones before cloning (default: reuse clone cache).",
    )
    args = parser.parse_args()

    out_root = Path(args.out).resolve()
    clone_root = Path(args.clone_cache).resolve()
    ref = args.ref
    max_file_bytes = int(args.max_file_kb) * 1024

    modules = _load_modules()
    repo_urls = _unique_github_repo_urls(modules)
    print(f"GitHub repo sources: {len(repo_urls)}")
    print(f"Clone cache: {clone_root}")
    print(f"Output: {out_root}")

    exts = {".md", ".mdx"}
    ignore_dirnames = {
        "node_modules",
        "dist",
        "build",
        "coverage",
        ".next",
        ".venv",
        "venv",
        ".git",
    }

    manifest: dict = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "repo_count": len(repo_urls),
        "max_file_kb": args.max_file_kb,
        "repos": [],
    }

    ok = 0
    for idx, url in enumerate(repo_urls, start=1):
        print(f"[{idx:>2}/{len(repo_urls)}] {url}")
        try:
            res = clone_and_export_repo_markdown(
                url,
                clone_root=clone_root,
                output_root=out_root,
                ref=ref,
                exts=exts,
                ignore_dirnames=ignore_dirnames,
                max_file_bytes=max_file_bytes,
                reclone=args.reclone,
            )
            ok += 1
            manifest["repos"].append(
                {
                    "repo_url": res.repo_url,
                    "head_sha": res.head_sha,
                    "export_dir": str(res.output_dir.relative_to(out_root)),
                    "markdown_files": res.markdown_files,
                    "exported_files": res.exported_files,
                    "skipped_too_large": res.skipped_too_large,
                }
            )
        except subprocess.CalledProcessError as exc:
            manifest["repos"].append(
                {
                    "repo_url": url,
                    "error": f"git_failed: exit_code={exc.returncode}",
                }
            )
        except Exception as exc:
            manifest["repos"].append(
                {
                    "repo_url": url,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

    manifest_path = out_root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Done: {ok}/{len(repo_urls)} repos exported. Manifest: {manifest_path}")


if __name__ == "__main__":
    main()

