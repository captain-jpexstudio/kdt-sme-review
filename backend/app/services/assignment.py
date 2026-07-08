"""할당 분배 — spec §13.2 그대로. xlsx 로드 + 7×300 라운드로빈."""
import random

import pandas as pd

ALIASES = {
    "질문": "question", "question": "question", "q": "question",
    "정답": "answer", "답변": "answer", "answer": "answer", "a": "answer",
    "배정페르소나": "assigned_persona", "assigned_persona": "assigned_persona",
    "persona": "assigned_persona",
    "해설": "rationale", "rationale": "rationale", "rationale_cot": "rationale", "설명": "rationale",
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
    # persona 없으면 solver(대상 특기) 기준 — 특기 수=검수자 수, 특기별 per건 균등일 때만
    if "solver" in df.columns and df["solver"].notna().all():
        counts = df["solver"].value_counts()
        if len(counts) == len(reviewer_ids) and (counts == per).all():
            m = dict(zip(sorted(counts.index), reviewer_ids))  # 특기 정렬순 ↔ reviewer_code 정렬순
            return [(i, m[df.at[i, "solver"]]) for i in range(n)]
    idx = list(range(n))
    random.Random(seed).shuffle(idx)
    return [(i, reviewer_ids[k // per]) for k, i in enumerate(idx)]
