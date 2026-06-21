"""실시간(SSE) 브로드캐스터 — spec §11. P0: 단일 인스턴스 in-process(asyncio.Queue)."""
import asyncio
from collections.abc import AsyncGenerator


class Broadcaster:
    def __init__(self) -> None:
        self._subs: set[asyncio.Queue] = set()

    async def publish(self, event: dict) -> None:
        for q in list(self._subs):
            await q.put(event)

    async def subscribe(self) -> AsyncGenerator[dict, None]:
        q: asyncio.Queue = asyncio.Queue()
        self._subs.add(q)
        try:
            while True:
                yield await q.get()
        finally:
            self._subs.discard(q)


broadcaster = Broadcaster()
