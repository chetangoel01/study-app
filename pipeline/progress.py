from __future__ import annotations

from typing import Iterable, Iterator, TypeVar

try:
    from tqdm.auto import tqdm as _tqdm
except ModuleNotFoundError:  # pragma: no cover - optional dependency in development
    _tqdm = None

T = TypeVar("T")


class _NullProgressBar:
    def __init__(self, *, total: int | None = None, desc: str = "", unit: str = "item") -> None:
        self.total = total
        self.desc = desc
        self.unit = unit

    def update(self, n: int = 1) -> None:
        return None

    def close(self) -> None:
        return None


def progress(iterable: Iterable[T], *, total: int | None = None, desc: str = "", unit: str = "item") -> Iterable[T]:
    if _tqdm is None:
        return iterable
    return _tqdm(iterable, total=total, desc=desc, unit=unit)


def progress_bar(*, total: int | None = None, desc: str = "", unit: str = "item") -> _NullProgressBar | object:
    if _tqdm is None:
        return _NullProgressBar(total=total, desc=desc, unit=unit)
    return _tqdm(total=total, desc=desc, unit=unit)


def progress_write(message: str) -> None:
    if _tqdm is None:
        print(message)
    else:
        _tqdm.write(message)
