"""할당 분배 — spec §13.2 그대로. xlsx 로드 + 7×300 라운드로빈."""
import random

import pandas as pd

ALIASES = {
    "질문": "question", "q": "question",
    "정답": "answer", "답변": "answer", "a": "answer",
    "배정페르소나": "assigned_persona", "persona": "assigned_persona",
}


def load_xlsx(path: str) -> pd.DataFrame:
    df = pd.read_excel(path, engine="openpyxl")
    df = df.rename(columns={c: ALIASES.get(str(c).strip().lower(), str(c).strip().lower()) for c in df.columns})
    if not {"question", "answer"} <= set(df.columns):
        raise ValueError("필수 컬럼(question,answer) 누락")
    return df.dropna(subset=["question", "answer"]).reset_index(drop=True)


def build_assignments(df: pd.DataFrame, reviewer_ids: list, per: int = 300, seed: int = 42):
    n = len(df)
    if n != len(reviewer_ids) * per:
        raise ValueError(f"문항 수 {n} != {len(reviewer_ids)}×{per}")
    if "assigned_persona" in df.columns and df["assigned_persona"].notna().all():
        m = dict(zip(sorted(df["assigned_persona"].unique()), reviewer_ids))
        return [(i, m[df.at[i, "assigned_persona"]]) for i in range(n)]
    idx = list(range(n))
    random.Random(seed).shuffle(idx)
    return [(i, reviewer_ids[k // per]) for k, i in enumerate(idx)]
