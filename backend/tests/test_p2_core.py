import asyncio
import base64
from collections import Counter
from io import BytesIO
from types import SimpleNamespace

import pandas as pd
import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageDraw
from sqlalchemy import delete, select, text

from app.api.admin import upload_datasets
from app.api.deps import agreed_reviewer, ensure_not_locked
from app.api.tasks import autosave, batch_eligibility, batch_submit, get_task, list_tasks, resume, submit, summary
from app.db.base import SessionLocal, engine
from app.db.models import AuditLog, BatchSubmission, Dataset, SignatureAsset, Task, User
from app.schemas.tasks import AutosaveRequest, BatchSubmitRequest, SubmitRequest
from app.seed import seed
from app.services.assignment import build_assignments

BATCH_ID = "pytest-p2-core"


def run(coro):
    async def wrapped():
        try:
            return await coro
        finally:
            await engine.dispose()

    return asyncio.run(wrapped())


async def cleanup_batch(db):
    dataset_ids = (
        await db.execute(select(Dataset.id).where(Dataset.batch_id == BATCH_ID))
    ).scalars().all()
    task_ids = []
    if dataset_ids:
        task_ids = (
            await db.execute(select(Task.id).where(Task.dataset_id.in_(dataset_ids)))
        ).scalars().all()
        await db.execute(delete(Task).where(Task.dataset_id.in_(dataset_ids)))
        await db.execute(delete(Dataset).where(Dataset.id.in_(dataset_ids)))
    submissions = (await db.execute(select(BatchSubmission.signature_asset_id))).scalars().all()
    await db.execute(delete(BatchSubmission))
    if submissions:
        await db.execute(delete(SignatureAsset).where(SignatureAsset.id.in_(submissions)))
    await db.execute(
        text("delete from audit_logs where details->>'batch_id' = :batch_id"),
        {"batch_id": BATCH_ID},
    )
    for task_id in task_ids:
        await db.execute(
            text("delete from audit_logs where details->>'task_id' = :task_id"),
            {"task_id": str(task_id)},
        )


async def users(db):
    await seed()
    admin = (await db.execute(select(User).where(User.username == "admin"))).scalar_one()
    reviewer1 = (
        await db.execute(select(User).where(User.username == "reviewer1"))
    ).scalar_one()
    reviewer2 = (
        await db.execute(select(User).where(User.username == "reviewer2"))
    ).scalar_one()
    reviewer1.is_agreed = True
    reviewer1.is_batch_submitted = False
    reviewer2.is_agreed = True
    reviewer2.is_batch_submitted = False
    await db.commit()
    await db.refresh(admin)
    await db.refresh(reviewer1)
    await db.refresh(reviewer2)
    return admin, reviewer1, reviewer2


def xlsx_upload(rows: int = 14) -> UploadFile:
    buf = BytesIO()
    pd.DataFrame(
        {
            "question": [f"질문 {i}" for i in range(rows)],
            "answer": [f"원본 정답 {i}" for i in range(rows)],
        }
    ).to_excel(buf, index=False)
    buf.seek(0)
    return UploadFile(filename="p2.xlsx", file=buf)


def signature_png() -> str:
    img = Image.new("RGBA", (320, 140), "white")
    draw = ImageDraw.Draw(img)
    draw.line((30, 90, 120, 40, 220, 88, 290, 54), fill="black", width=4)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def test_assignment_splits_2100_items_into_7_reviewers():
    reviewers = [f"R{i}" for i in range(7)]
    df = pd.DataFrame(
        {
            "question": [f"q{i}" for i in range(2100)],
            "answer": [f"a{i}" for i in range(2100)],
        }
    )

    assignments = build_assignments(df, reviewers, per=300)
    counts = Counter(reviewer for _, reviewer in assignments)

    assert len(assignments) == 2100
    assert counts == {reviewer: 300 for reviewer in reviewers}


def test_p2_upload_task_flow_active_edit_and_version_conflict():
    async def scenario():
        async with SessionLocal() as db:
            await cleanup_batch(db)
            admin, reviewer, _ = await users(db)

            uploaded = await upload_datasets(
                file=xlsx_upload(),
                batch_id=BATCH_ID,
                per_reviewer=2,
                admin=admin,
                db=db,
            )
            assert uploaded.datasets == 14
            assert uploaded.tasks == 14
            assert uploaded.reviewers == 7
            assert uploaded.per_reviewer == 2

            counts = (
                await db.execute(
                    select(Task.user_id, text("count(*)"))
                    .join(Dataset, Dataset.id == Task.dataset_id)
                    .where(Dataset.batch_id == BATCH_ID)
                    .group_by(Task.user_id)
                )
            ).all()
            assert {count for _, count in counts} == {2}

            s = await summary(user=reviewer, db=db)
            assert s.total == 2
            assert s.pending == 2

            items = await list_tasks(sort="seq", user=reviewer, db=db)
            assert len(items) == 2
            detail = await get_task(task_id=items[0].task_id, user=reviewer, db=db)

            request = SimpleNamespace(headers={}, client=None)
            saved = await autosave(
                task_id=items[0].task_id,
                body=AutosaveRequest(
                    version=detail.version,
                    draft_q=detail.original_q,
                    draft_a=f"{detail.original_a} 초안",
                ),
                request=request,
                user=reviewer,
                db=db,
            )
            assert saved.status == "in_progress"
            assert saved.version == detail.version + 1

            completed = await submit(
                task_id=items[0].task_id,
                body=SubmitRequest(
                    version=saved.version,
                    modified_q=detail.original_q,
                    modified_a=f"{detail.original_a} 수정",
                ),
                request=request,
                user=reviewer,
                db=db,
            )
            assert completed.status == "completed"
            assert completed.version == saved.version + 1
            assert completed.suspicious is False

            resumed = await resume(user=reviewer, db=db)
            assert resumed is not None
            assert resumed.task_id == items[0].task_id

            re_edit = await autosave(
                task_id=items[0].task_id,
                body=AutosaveRequest(
                    version=completed.version,
                    draft_q=detail.original_q,
                    draft_a=f"{detail.original_a} 재수정",
                ),
                request=request,
                user=reviewer,
                db=db,
            )
            assert re_edit.status == "in_progress"

            with pytest.raises(HTTPException) as stale:
                await submit(
                    task_id=items[0].task_id,
                    body=SubmitRequest(
                        version=saved.version,
                        modified_q=detail.original_q,
                        modified_a=f"{detail.original_a} 다시수정",
                    ),
                    request=request,
                    user=reviewer,
                    db=db,
                )
            assert stale.value.status_code == 409
            assert stale.value.detail["error_code"] == "VERSION_CONFLICT"

            audit_actions = (
                await db.execute(
                    select(AuditLog.action_type)
                    .where(AuditLog.details["task_id"].astext == str(items[0].task_id))
                    .order_by(AuditLog.id)
                )
            ).scalars().all()
            assert "AUTOSAVE" in audit_actions
            assert "SUBMIT" in audit_actions

            await cleanup_batch(db)
            await db.commit()

    run(scenario())


def test_p2_rejects_identical_submit_and_foreign_task():
    async def scenario():
        async with SessionLocal() as db:
            await cleanup_batch(db)
            admin, reviewer1, reviewer2 = await users(db)

            await upload_datasets(
                file=xlsx_upload(),
                batch_id=BATCH_ID,
                per_reviewer=2,
                admin=admin,
                db=db,
            )
            item = (await list_tasks(sort="seq", user=reviewer1, db=db))[0]
            detail = await get_task(task_id=item.task_id, user=reviewer1, db=db)
            request = SimpleNamespace(headers={}, client=None)

            with pytest.raises(HTTPException) as active_edit:
                await submit(
                    task_id=item.task_id,
                    body=SubmitRequest(
                        version=detail.version,
                        modified_q=detail.original_q,
                        modified_a=detail.original_a,
                    ),
                    request=request,
                    user=reviewer1,
                    db=db,
                )
            assert active_edit.value.status_code == 400
            assert active_edit.value.detail["error_code"] == "ACTIVE_EDIT_REQUIRED"

            with pytest.raises(HTTPException) as foreign:
                await get_task(task_id=item.task_id, user=reviewer2, db=db)
            assert foreign.value.status_code == 404
            assert foreign.value.detail["error_code"] == "NOT_FOUND"

            await cleanup_batch(db)
            await db.commit()

    run(scenario())


def test_p2_reviewer_guards_require_agreement_and_unlocked_account():
    async def scenario():
        async with SessionLocal() as db:
            _, reviewer, _ = await users(db)

            reviewer.is_agreed = False
            await db.commit()
            await db.refresh(reviewer)
            with pytest.raises(HTTPException) as not_agreed:
                await agreed_reviewer(reviewer)
            assert not_agreed.value.status_code == 403
            assert not_agreed.value.detail["error_code"] == "NOT_AGREED"

            reviewer.is_agreed = True
            reviewer.is_batch_submitted = True
            await db.commit()
            await db.refresh(reviewer)
            with pytest.raises(HTTPException) as locked:
                await ensure_not_locked(reviewer)
            assert locked.value.status_code == 423
            assert locked.value.detail["error_code"] == "BATCH_LOCKED"

            reviewer.is_batch_submitted = False
            await db.commit()

    run(scenario())


def test_p4_batch_submit_locks_completed_reviewer_and_blocks_edits():
    async def scenario():
        async with SessionLocal() as db:
            await cleanup_batch(db)
            admin, reviewer, _ = await users(db)
            await upload_datasets(
                file=xlsx_upload(),
                batch_id=BATCH_ID,
                per_reviewer=2,
                admin=admin,
                db=db,
            )
            request = SimpleNamespace(headers={}, client=None)

            incomplete = await batch_eligibility(user=reviewer, db=db)
            assert incomplete.total == 2
            assert incomplete.completed == 0
            assert incomplete.eligible is False

            with pytest.raises(HTTPException) as err:
                await batch_submit(
                    body=BatchSubmitRequest(typed_name="홍길동", signature_png=signature_png()),
                    request=request,
                    user=reviewer,
                    db=db,
                )
            assert err.value.status_code == 400
            assert err.value.detail["error_code"] == "INCOMPLETE_TASKS"

            for item in await list_tasks(sort="seq", user=reviewer, db=db):
                detail = await get_task(task_id=item.task_id, user=reviewer, db=db)
                await submit(
                    task_id=item.task_id,
                    body=SubmitRequest(
                        version=detail.version,
                        modified_q=detail.original_q,
                        modified_a=f"{detail.original_a} 수정",
                    ),
                    request=request,
                    user=reviewer,
                    db=db,
                )

            eligible = await batch_eligibility(user=reviewer, db=db)
            assert eligible.completed == 2
            assert eligible.eligible is True

            locked = await batch_submit(
                body=BatchSubmitRequest(typed_name="홍길동", signature_png=signature_png()),
                request=request,
                user=reviewer,
                db=db,
            )
            assert locked.status == "locked"
            assert locked.completed == 2
            assert locked.final_pdf_key
            await db.refresh(reviewer)
            assert reviewer.is_batch_submitted is True
            assert reviewer.batch_submitted_at is not None

            after = await batch_eligibility(user=reviewer, db=db)
            assert after.locked is True
            assert after.eligible is False

            with pytest.raises(HTTPException) as edit:
                await ensure_not_locked(reviewer)
            assert edit.value.status_code == 423

            actions = (
                await db.execute(select(AuditLog.action_type).where(AuditLog.user_id == reviewer.id))
            ).scalars().all()
            assert "BATCH_SUBMIT" in actions

            await cleanup_batch(db)
            reviewer.is_batch_submitted = False
            reviewer.batch_submitted_at = None
            await db.commit()

    run(scenario())
