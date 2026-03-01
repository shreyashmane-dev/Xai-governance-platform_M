import json
import os
import uuid
from typing import List

try:
    from bson import ObjectId
except ImportError:  # pragma: no cover - bson is optional for local DB mode
    ObjectId = None

class LocalCollection:
    def __init__(self, name: str, db_path: str):
        self.name = name
        self.db_path = db_path
        self.file_path = os.path.join(db_path, f"{name}.json")
        self._ensure_file()

    def _ensure_file(self):
        if not os.path.exists(self.file_path):
            with open(self.file_path, 'w') as f:
                json.dump([], f)

    def _read_data(self) -> List[dict]:
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _write_data(self, data: List[dict]):
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    @staticmethod
    def _id_equal(left, right) -> bool:
        return str(left) == str(right)

    @staticmethod
    def _new_id() -> str:
        if ObjectId is not None:
            return str(ObjectId())
        return uuid.uuid4().hex

    def _match(self, doc: dict, filter: dict) -> bool:
        if not filter:
            return True

        for key, value in filter.items():
            if key == "$or":
                if not isinstance(value, list) or not value:
                    return False
                if not any(self._match(doc, clause) for clause in value):
                    return False
                continue

            if key == "_id":
                if not self._id_equal(doc.get("_id"), value):
                    return False
                continue

            if isinstance(value, dict) and "$in" in value:
                allowed = value["$in"] or []
                if doc.get(key) not in allowed:
                    return False
                continue

            if doc.get(key) != value:
                return False

        return True

    async def insert_one(self, document: dict):
        data = self._read_data()
        if "_id" not in document:
            document["_id"] = self._new_id()
        else:
            document["_id"] = str(document["_id"])
        data.append(document)
        self._write_data(data)
        return type("InsertOneResult", (), {"inserted_id": document["_id"]})

    async def find_one(self, filter: dict, sort=None):
        data = self._read_data()
        matched = [doc for doc in data if self._match(doc, filter)]
        if sort and matched:
            key, direction = sort[0]
            reverse = direction == -1
            matched.sort(key=lambda row: row.get(key, ""), reverse=reverse)
        if matched:
            return matched[0]
        return None

    def find(self, filter: dict = None):
        return LocalCursor(self._read_data(), filter)

    async def create_index(self, keys, **kwargs):
        # Indexing is not supported for local file DB but we mock it
        pass

    async def count_documents(self, filter: dict):
        data = self._read_data()
        return sum(1 for doc in data if self._match(doc, filter))

    async def update_one(self, filter: dict, update: dict):
        data = self._read_data()
        matched = 0
        modified = 0
        set_values = update.get("$set", {})
        for idx, doc in enumerate(data):
            if self._match(doc, filter):
                matched = 1
                if set_values:
                    data[idx] = {**doc, **set_values}
                    modified = 1
                break
        if modified:
            self._write_data(data)
        return type("UpdateResult", (), {"matched_count": matched, "modified_count": modified})

    async def delete_one(self, filter: dict):
        data = self._read_data()
        new_data = []
        deleted = False
        for doc in data:
            if not deleted and self._match(doc, filter):
                deleted = True
                continue
            new_data.append(doc)
        self._write_data(new_data)
        return type("DeleteResult", (), {"deleted_count": 1 if deleted else 0})

    async def delete_many(self, filter: dict):
        data = self._read_data()
        kept = [doc for doc in data if not self._match(doc, filter)]
        deleted_count = len(data) - len(kept)
        if deleted_count:
            self._write_data(kept)
        return type("DeleteResult", (), {"deleted_count": deleted_count})

class LocalCursor:
    def __init__(self, data: List[dict], filter: dict = None):
        self.data = data
        if filter:
            self.data = [doc for doc in data if self._match(doc, filter)]
        self._limit = None
        self._sort = None

    def _match(self, doc, filter):
        for k, v in filter.items():
            if k == "$or":
                if not any(self._match(doc, clause) for clause in v):
                    return False
                continue
            if k == "_id":
                if str(doc.get("_id")) != str(v):
                    return False
            elif isinstance(v, dict) and "$in" in v:
                if doc.get(k) not in (v.get("$in") or []):
                    return False
            elif doc.get(k) != v:
                return False
        return True

    def sort(self, key_or_list, direction: int = None):
        if isinstance(key_or_list, list):
            # Simplify to first sort key for local mockup
            key, direction = key_or_list[0]
        else:
            key = key_or_list
        
        reverse = direction == -1
        self.data.sort(key=lambda x: x.get(key, ""), reverse=reverse)
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    async def to_list(self, length: int = None):
        res = self.data
        if self._limit is not None:
            res = res[:self._limit]
        if length is not None:
            res = res[:length]
        return res

class LocalDB:
    def __init__(self, db_name: str, base_path: str = "data"):
        self.db_name = db_name
        self.path = os.path.join(base_path, db_name)
        os.makedirs(self.path, exist_ok=True)
        self.collections = {}

    def __getitem__(self, name: str):
        if name not in self.collections:
            self.collections[name] = LocalCollection(name, self.path)
        return self.collections[name]

    def __getattr__(self, name: str):
        return self.__getitem__(name)

    async def command(self, cmd: str):
        if cmd == "ping":
            return {"ok": 1.0}
        return {}
    @staticmethod
    def _new_id() -> str:
        if ObjectId is not None:
            return str(ObjectId())
        return uuid.uuid4().hex
