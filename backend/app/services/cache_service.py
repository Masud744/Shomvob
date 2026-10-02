from __future__ import annotations

import logging
import threading
import time
from typing import Any, Optional, Dict, Tuple

logger = logging.getLogger(__name__)


class InMemoryTTLCache:
    """
    Thread-safe, zero-dependency in-memory TTL cache with bounded memory protection.
    Stores cached items in RAM for ultra-fast (sub-millisecond) retrieval.
    """

    def __init__(self, default_ttl_seconds: int = 300, max_size: int = 1000):
        self.default_ttl = default_ttl_seconds
        self.max_size = max_size
        self._cache: Dict[str, Tuple[float, float, Any]] = {}  # key -> (stored_at, ttl, value)
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._cache:
                return None
            stored_at, ttl, val = self._cache[key]
            if time.time() - stored_at > ttl:
                del self._cache[key]
                return None
            return val

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        with self._lock:
            # Memory boundary guard: evict expired or oldest entries if capacity reached
            if len(self._cache) >= self.max_size:
                now = time.time()
                expired = [k for k, (stored, ttl, _) in self._cache.items() if now - stored > ttl]
                for k in expired:
                    del self._cache[k]
                # If still at capacity, evict oldest 20%
                if len(self._cache) >= self.max_size:
                    sorted_keys = sorted(self._cache.keys(), key=lambda k: self._cache[k][0])
                    for k in sorted_keys[: self.max_size // 5]:
                        del self._cache[k]

            ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
            self._cache[key] = (time.time(), ttl, value)

    def invalidate(self, prefix: str = "") -> int:
        """
        Invalidates keys matching the prefix. If prefix is empty, clears all keys.
        """
        with self._lock:
            if not prefix:
                count = len(self._cache)
                self._cache.clear()
                return count
            keys_to_delete = [k for k in self._cache if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._cache[k]
            return len(keys_to_delete)


class SyncThrottler:
    """
    Prevents external API abuse and IP rate-limiting.
    Ensures that heavy web scraping (Devpost, Facebook, etc.) can only run
    once every `cooldown_seconds` (default: 10 minutes).
    """

    def __init__(self, cooldown_seconds: int = 600):
        self.cooldown_seconds = cooldown_seconds
        self._last_sync_time: float = 0.0
        self._lock = threading.Lock()

    def can_sync(self) -> Tuple[bool, int]:
        """
        Returns (True, 0) if sync is allowed.
        Returns (False, remaining_seconds) if cooldown is active.
        """
        with self._lock:
            elapsed = time.time() - self._last_sync_time
            if elapsed >= self.cooldown_seconds or self._last_sync_time == 0.0:
                return True, 0
            remaining = int(self.cooldown_seconds - elapsed)
            return False, remaining

    def record_sync(self) -> None:
        with self._lock:
            self._last_sync_time = time.time()


# Global singletons
memory_cache = InMemoryTTLCache(default_ttl_seconds=300)  # 5 minutes default
sync_throttler = SyncThrottler(cooldown_seconds=600)      # 10 minutes sync cooldown
