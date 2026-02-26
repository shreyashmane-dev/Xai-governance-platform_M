import os
import re
from uuid import uuid4


def safe_storage_path(upload_dir: str, original_name: str) -> str:
    os.makedirs(upload_dir, exist_ok=True)
    stem, ext = os.path.splitext(original_name)
    clean_stem = re.sub(r"[^a-zA-Z0-9_-]+", "_", stem).strip("_") or "asset"
    return os.path.join(upload_dir, f"{clean_stem}_{uuid4().hex[:12]}{ext.lower()}")
