"""시드 — admin 1 + reviewer 7 (spec §17). 실행: python -m app.seed"""
import asyncio

from sqlalchemy import select

from app.core.security import hash_password
from app.db.base import SessionLocal
from app.db.models import User


async def seed() -> None:
    async with SessionLocal() as db:
        existing = (await db.execute(select(User.username))).scalars().all()
        rows = [("admin", "admin", None)] + [
            (f"reviewer{i}", "reviewer", f"REV-{i:03d}") for i in range(1, 8)
        ]
        for username, role, code in rows:
            if username in existing:
                continue
            db.add(
                User(
                    username=username,
                    password_hash=hash_password("change-me"),
                    role=role,
                    reviewer_code=code,
                )
            )
        await db.commit()
    print("seeded: admin + reviewer1..7")


if __name__ == "__main__":
    asyncio.run(seed())
