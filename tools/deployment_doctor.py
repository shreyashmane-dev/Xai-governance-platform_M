#!/usr/bin/env python3
"""
Deployment Doctor

Standalone diagnostics utility for Render (FastAPI) + Vercel (React/Next) setups.
Does not require project imports or third-party packages.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_BACKEND = "https://xai-governance-platform-vnhj.onrender.com"


def http_get(url: str, timeout: float = 12.0) -> tuple[int, str]:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.getcode(), body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, body
    except urllib.error.URLError as exc:
        return 0, str(exc)


def parse_env_file(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.exists():
        return data
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def print_check(name: str, ok: bool, detail: str) -> None:
    status = "OK" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check backend/frontend deployment wiring.")
    parser.add_argument("--backend", default=DEFAULT_BACKEND, help="Backend origin URL (no trailing /api required).")
    parser.add_argument("--frontend-env", default="frontend/.env", help="Path to frontend env file.")
    args = parser.parse_args()

    backend = args.backend.rstrip("/")
    backend_api = backend if backend.endswith("/api") else f"{backend}/api"
    failures = 0

    checks = [
        ("Backend root", f"{backend}/"),
        ("Backend health", f"{backend}/health"),
        ("Backend healthz", f"{backend}/healthz"),
        ("Chat method info", f"{backend_api}/chat"),
    ]

    for name, url in checks:
        code, body = http_get(url)
        ok = 200 <= code < 300
        if name == "Chat method info":
            ok = ok and ("POST" in body or "method" in body.lower())
        print_check(name, ok, f"HTTP {code} @ {url}")
        if not ok:
            failures += 1

    env_path = Path(args.frontend_env)
    env_values = parse_env_file(env_path)
    vite_api = env_values.get("VITE_API_URL")
    next_api = env_values.get("NEXT_PUBLIC_API_URL")

    if env_path.exists():
        has_vite = bool(vite_api)
        has_next = bool(next_api)
        print_check("Frontend env file", True, f"Found {env_path}")
        print_check("VITE_API_URL", has_vite, vite_api or "missing")
        if not has_vite:
            failures += 1
        print_check("NEXT_PUBLIC_API_URL", has_next, next_api or "missing")
        if not has_next:
            failures += 1
    else:
        print_check("Frontend env file", False, f"Missing: {env_path}")
        failures += 1

    summary = {
        "backend": backend,
        "backend_api": backend_api,
        "frontend_env_file": str(env_path),
        "status": "pass" if failures == 0 else "fail",
        "failures": failures,
    }
    print("\nSummary:")
    print(json.dumps(summary, indent=2))

    if failures:
        print("\nRecommended fixes:")
        print("1. Set NEXT_PUBLIC_API_URL to backend origin (without /api).")
        print("2. Set VITE_API_URL to backend origin or backend/api.")
        print("3. Ensure backend exposes GET /health and POST /api/chat.")
        print("4. Ensure CORS allows your frontend origin.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
