import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import build_study_data


class BuildStudyDataLeetCodeImportTests(unittest.TestCase):
    def test_load_leetcode_course_modules_returns_empty_when_manifest_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            modules = build_study_data.load_leetcode_course_modules(Path(tmp))

        self.assertEqual(modules, [])

    def test_load_leetcode_course_modules_imports_selected_chapters(self):
        with tempfile.TemporaryDirectory() as tmp:
            export_dir = Path(tmp)
            chapters_dir = export_dir / "chapters"
            chapters_dir.mkdir(parents=True)

            manifest = {
                "courseSlug": "leetcode-crash-course",
                "chapters": [
                    {
                        "slug": "greedy",
                        "path": "chapters/01-greedy.json",
                    },
                    {
                        "slug": "bonus",
                        "path": "chapters/02-bonus.json",
                    },
                ],
            }
            (export_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

            greedy_chapter = {
                "chapter": {
                    "id": "709",
                    "title": "Greedy",
                    "slug": "greedy",
                    "descriptionText": "Greedy focuses on making locally optimal choices.",
                    "items": [
                        {
                            "id": "4529",
                            "title": "Greedy algorithms",
                            "question": None,
                        },
                        {
                            "id": "4560",
                            "title": "Maximum 69 Number",
                            "question": {"title": "Maximum 69 Number", "titleSlug": "maximum-69-number"},
                        },
                    ],
                }
            }
            bonus_chapter = {
                "chapter": {
                    "id": "714",
                    "title": "Bonus",
                    "slug": "bonus",
                    "descriptionText": "Bonus techniques.",
                    "items": [
                        {
                            "id": "4688",
                            "title": "Difference array",
                            "question": None,
                        }
                    ],
                }
            }
            (chapters_dir / "01-greedy.json").write_text(json.dumps(greedy_chapter), encoding="utf-8")
            (chapters_dir / "02-bonus.json").write_text(json.dumps(bonus_chapter), encoding="utf-8")

            modules = build_study_data.load_leetcode_course_modules(export_dir)

        self.assertEqual(len(modules), 1)
        module = modules[0]
        self.assertEqual(module["id"], "leetcode-course-greedy")
        self.assertEqual(module["title"], "LeetCode Crash Course: Greedy")
        self.assertEqual(module["phase"], "LeetCode Course")
        self.assertFalse(module["countsTowardSchedule"])
        self.assertEqual(module["estimate"], "2 sessions")
        self.assertEqual(module["sessions"], 2)
        self.assertEqual(
            module["items"],
            ["Study: Greedy algorithms", "Solve: Maximum 69 Number"],
        )
        self.assertEqual(
            module["sourceUrl"],
            "https://leetcode.com/explore/interview/card/leetcode-crash-course/709/greedy/",
        )
        self.assertEqual(
            module["resources"][1]["url"],
            "https://leetcode.com/explore/interview/card/leetcode-crash-course/709/greedy/4529/",
        )
        self.assertEqual(
            module["resources"][2]["label"],
            "Problem: Maximum 69 Number",
        )

    def test_load_dynamic_pipeline_only_modules_uses_local_item_exports(self):
        with tempfile.TemporaryDirectory() as tmp:
            export_dir = Path(tmp)
            chapters_dir = export_dir / "chapters"
            items_dir = export_dir / "items"
            chapters_dir.mkdir(parents=True)
            items_dir.mkdir(parents=True)

            manifest = {
                "courseSlug": "leetcode-crash-course",
                "chapters": [
                    {
                        "slug": "introduction",
                        "path": "chapters/01-introduction.json",
                    }
                ],
            }
            (export_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

            item_payload = {
                "chapterTitle": "Introduction",
                "item": {"id": "4654", "title": "Introduction to big O"},
                "content": {"kind": "article", "status": "ok", "textContent": "Big O notes"},
            }
            item_path = items_dir / "001-introduction-to-big-o.json"
            item_path.write_text(json.dumps(item_payload), encoding="utf-8")

            chapter_payload = {
                "chapter": {
                    "id": "715",
                    "title": "Introduction",
                    "slug": "introduction",
                    "descriptionText": "Start here.",
                },
                "items": [
                    {
                        "id": "4654",
                        "title": "Introduction to big O",
                        "status": "ok",
                        "textLength": 11,
                        "path": "items/001-introduction-to-big-o.json",
                    },
                    {
                        "id": "4822",
                        "title": "Testimonials",
                        "status": "ok",
                        "textLength": 999,
                        "path": "items/002-testimonials.json",
                    },
                ],
            }
            (chapters_dir / "01-introduction.json").write_text(json.dumps(chapter_payload), encoding="utf-8")

            modules = build_study_data.load_dynamic_pipeline_only_modules(export_dir)

        self.assertEqual(len(modules), 1)
        module = modules[0]
        self.assertEqual(module["id"], "leetcode-export-introduction")
        self.assertEqual(module["phase"], "Supplemental")
        self.assertEqual(len(module["resources"]), 1)
        self.assertEqual(module["resources"][0]["label"], "Introduction to big O")
        self.assertEqual(
            module["resources"][0]["url"],
            "https://leetcode.com/explore/interview/card/leetcode-crash-course/715/introduction/4654/",
        )
        self.assertTrue(module["resources"][0]["sourcePath"].endswith("items/001-introduction-to-big-o.json"))


if __name__ == "__main__":
    unittest.main()
