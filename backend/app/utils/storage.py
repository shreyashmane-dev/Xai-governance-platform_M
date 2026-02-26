import os

from app.core.config import settings
from app.utils.files import safe_storage_path


class ArtifactStorageError(Exception):
    pass


def persist_artifact(raw: bytes, original_name: str, resource_type: str) -> dict:
    _ = resource_type
    local_path = safe_storage_path(settings.upload_dir, original_name)
    with open(local_path, "wb") as out:
        out.write(raw)

    return {
        "storage_path": local_path,
        "storage_backend": "local",
        "storage_key": None,
    }


def resolve_artifact_path(doc: dict, resource_type: str) -> str:
    storage_path = doc.get("storage_path")
    if storage_path and os.path.exists(storage_path):
        return storage_path

    raise ArtifactStorageError(
        f"{resource_type.capitalize()} artifact missing on local storage. Re-upload the file."
    )


def delete_artifact(doc: dict) -> None:
    storage_path = doc.get("storage_path")
    if storage_path and os.path.exists(storage_path):
        try:
            os.remove(storage_path)
        except OSError:
            pass
