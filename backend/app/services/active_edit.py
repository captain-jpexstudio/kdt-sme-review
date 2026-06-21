"""Active Edit 검증 — spec §13.1 그대로. 제출 시 서버 권위 검증."""
import re
import unicodedata
from difflib import SequenceMatcher

from app.core.config import settings


def _norm(t: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", t or "").strip())


def _tok(t: str) -> list[str]:
    return [w for w in re.sub(r"[^\w가-힣\s]", " ", _norm(t)).split() if w]


def diff_stats(orig: str, mod: str) -> dict:
    o, m = _tok(orig), _tok(mod)
    sm = SequenceMatcher(a=o, b=m, autojunk=False)
    rep = ins = dele = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "replace":
            rep += max(i2 - i1, j2 - j1)
        elif tag == "insert":
            ins += j2 - j1
        elif tag == "delete":
            dele += i2 - i1
    ch = rep + ins + dele
    return {
        "changed_words": ch,
        "change_ratio": ch / max(len(o), 1),
        "identical": _norm(orig) == _norm(mod),
        "mod_words": len(m),
    }


class ActiveEditError(Exception):
    ...


def verify_active_edit(original_a: str, modified_a: str) -> dict:
    s = diff_stats(original_a, modified_a)
    if s["mod_words"] == 0:
        raise ActiveEditError("정답이 비어 있습니다.")
    if s["identical"] or s["changed_words"] < settings.MIN_WORD_CHANGES:
        raise ActiveEditError("정답을 최소 1단어 이상 수정(패러프레이징)해야 합니다.")
    s["suspicious"] = s["change_ratio"] < settings.SUSPICIOUS_RATIO  # 차단X, 관리자 검토
    return s
