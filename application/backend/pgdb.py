"""Lapisan database PostgreSQL (JSONB) dengan API mirip Motor/MongoDB agar kode aplikasi tidak perlu diubah."""
import re
import json
import uuid
import copy
import asyncio
from datetime import datetime, date
from types import SimpleNamespace

import asyncpg

_NAME = re.compile(r"^[a-z_][a-z0-9_]*$")


def _default(o):
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    if isinstance(o, bytes):
        return o.decode("utf-8", "ignore")
    return str(o)


def _dumps(v) -> str:
    return json.dumps(v, default=_default, ensure_ascii=False)


def _clean(doc: dict) -> dict:
    return json.loads(_dumps({k: v for k, v in doc.items() if k != "_id"}))


def _nest(path: str, value):
    out = value
    for part in reversed(path.split(".")):
        out = {part: out}
    return out


def _get(doc, path, default=None):
    cur = doc
    for p in path.split("."):
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return default
    return cur


def _set(doc, path, value):
    parts = path.split(".")
    cur = doc
    for p in parts[:-1]:
        if not isinstance(cur.get(p), dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


def _unset(doc, path):
    parts = path.split(".")
    cur = doc
    for p in parts[:-1]:
        cur = cur.get(p)
        if not isinstance(cur, dict):
            return
    cur.pop(parts[-1], None)


class _Params:
    def __init__(self):
        self.values = []

    def add(self, v) -> str:
        self.values.append(v)
        return f"${len(self.values)}"


def _expr(path: str, P: _Params) -> str:
    return f"(doc #> {P.add(path.split('.'))}::text[])"


def _eq(path: str, v, P: _Params) -> str:
    if v is None:
        E = _expr(path, P)
        return f"({E} IS NULL OR {E} = 'null'::jsonb)"
    if isinstance(v, (dict, list)):
        return f"({_expr(path, P)} = {P.add(_dumps(v))}::jsonb)"
    a = P.add(_dumps(_nest(path, v)))
    b = P.add(_dumps(_nest(path, [v])))
    return f"(doc @> {a}::jsonb OR doc @> {b}::jsonb)"


def _cmp(path: str, op: str, v, P: _Params) -> str:
    E = _expr(path, P)
    sql_op = {"$gt": ">", "$gte": ">=", "$lt": "<", "$lte": "<="}[op]
    if isinstance(v, bool):
        return f"(CASE WHEN jsonb_typeof({E}) = 'boolean' THEN ({E} #>> '{{}}')::boolean {sql_op} {P.add(v)}::boolean ELSE false END)"
    if isinstance(v, (int, float)):
        return f"(CASE WHEN jsonb_typeof({E}) = 'number' THEN ({E} #>> '{{}}')::numeric {sql_op} {P.add(str(v))}::numeric ELSE false END)"
    return f"(CASE WHEN jsonb_typeof({E}) = 'string' THEN ({E} #>> '{{}}') COLLATE \"C\" {sql_op} {P.add(str(v))}::text COLLATE \"C\" ELSE false END)"


def _field(path: str, cond, P: _Params) -> str:
    if path == "_id":
        if isinstance(cond, dict) and "$in" in cond:
            return f"(_id = ANY({P.add([str(x) for x in cond['$in']])}::text[]))"
        return f"(_id = {P.add(str(cond))})"
    if not (isinstance(cond, dict) and cond and all(k.startswith("$") for k in cond)):
        return _eq(path, cond, P)
    parts = []
    for op, v in cond.items():
        if op == "$eq":
            parts.append(_eq(path, v, P))
        elif op == "$ne":
            parts.append(f"NOT {_eq(path, v, P)}")
        elif op in ("$in", "$nin"):
            sub = "(" + " OR ".join(_eq(path, x, P) for x in v) + ")" if v else "false"
            parts.append(sub if op == "$in" else f"NOT {sub}")
        elif op in ("$gt", "$gte", "$lt", "$lte"):
            parts.append(_cmp(path, op, v, P))
        elif op == "$regex":
            E = _expr(path, P)
            flags = cond.get("$options", "")
            pat = v.pattern if hasattr(v, "pattern") else v
            rx_op = "~*" if "i" in flags else "~"
            parts.append(f"(CASE WHEN jsonb_typeof({E}) = 'string' THEN ({E} #>> '{{}}') {rx_op} {P.add(pat)} ELSE false END)")
        elif op == "$exists":
            parts.append(f"({_expr(path, P)} IS {'NOT ' if v else ''}NULL)")
        elif op == "$options":
            continue
        else:
            raise NotImplementedError(f"Operator {op} belum didukung")
    return "(" + " AND ".join(parts) + ")" if parts else "true"


def _where(f: dict, P: _Params) -> str:
    parts = []
    for k, v in (f or {}).items():
        if k in ("$or", "$and", "$nor"):
            subs = [_where(x, P) for x in v]
            if k == "$or":
                parts.append("(" + " OR ".join(subs) + ")" if subs else "false")
            elif k == "$and":
                parts.append("(" + " AND ".join(subs) + ")" if subs else "true")
            else:
                parts.append("NOT (" + " OR ".join(subs) + ")" if subs else "true")
        else:
            parts.append(_field(k, v, P))
    return " AND ".join(parts) or "true"


def _order(sort, P: _Params) -> str:
    if not sort:
        return ""
    cols = []
    for key, d in sort:
        E = "_id" if key == "_id" else _expr(key, P)
        cols.append(f"{E} {'ASC NULLS FIRST' if d >= 0 else 'DESC NULLS LAST'}")
    return " ORDER BY " + ", ".join(cols)


def _project(doc: dict, proj) -> dict:
    if not proj:
        return doc
    proj = dict(proj)
    keep_id = proj.pop("_id", 1)
    if any(v for v in proj.values()):
        out = {"_id": doc["_id"]} if keep_id and "_id" in doc else {}
        for k in proj:
            v = _get(doc, k, _MISSING)
            if v is not _MISSING:
                _set(out, k, v)
        return out
    out = copy.deepcopy(doc)
    if not keep_id:
        out.pop("_id", None)
    for k in proj:
        _unset(out, k)
    return out


_MISSING = object()


def _apply_update(doc: dict, upd: dict, inserting: bool) -> dict:
    if not any(k.startswith("$") for k in upd):
        return {**copy.deepcopy(upd)}
    doc = copy.deepcopy(doc)
    for op, fields in upd.items():
        for k, v in fields.items():
            if op == "$set":
                _set(doc, k, v)
            elif op == "$setOnInsert":
                if inserting:
                    _set(doc, k, v)
            elif op == "$unset":
                _unset(doc, k)
            elif op == "$inc":
                _set(doc, k, (_get(doc, k) or 0) + v)
            elif op == "$push":
                arr = list(_get(doc, k) or [])
                arr.extend(v["$each"] if isinstance(v, dict) and "$each" in v else [v])
                _set(doc, k, arr)
            elif op == "$addToSet":
                arr = list(_get(doc, k) or [])
                for x in (v["$each"] if isinstance(v, dict) and "$each" in v else [v]):
                    if x not in arr:
                        arr.append(x)
                _set(doc, k, arr)
            elif op == "$pull":
                arr = list(_get(doc, k) or [])
                _set(doc, k, [x for x in arr if x != v])
            elif op == "$min":
                cur = _get(doc, k)
                if cur is None or v < cur:
                    _set(doc, k, v)
            elif op == "$max":
                cur = _get(doc, k)
                if cur is None or v > cur:
                    _set(doc, k, v)
            else:
                raise NotImplementedError(f"Operator update {op} belum didukung")
    return doc


def _upsert_base(f: dict) -> dict:
    base = {}
    for k, v in (f or {}).items():
        if not k.startswith("$") and not (isinstance(v, dict) and any(x.startswith("$") for x in v)):
            _set(base, k, v)
    return base


def _row(r) -> dict:
    d = json.loads(r["doc"]) if isinstance(r["doc"], str) else dict(r["doc"])
    return {"_id": r["_id"], **d}


class Cursor:
    def __init__(self, col, flt, proj):
        self.col, self.flt, self.proj = col, flt, proj
        self._sort, self._skip, self._limit = [], 0, 0

    def sort(self, key, direction=1):
        self._sort = list(key) if isinstance(key, (list, tuple)) else [(key, direction)]
        return self

    def skip(self, n):
        self._skip = n
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, length=None):
        n = self._limit or length
        return await self.col._select(self.flt, self.proj, self._sort, self._skip, n)

    def __aiter__(self):
        async def gen():
            for d in await self.to_list(None):
                yield d
        return gen()


class AggCursor:
    def __init__(self, col, pipeline):
        self.col, self.pipeline = col, pipeline

    async def to_list(self, length=None):
        stages = list(self.pipeline)
        flt = stages.pop(0)["$match"] if stages and "$match" in stages[0] else {}
        docs = await self.col._select(flt, None, [], 0, None)
        for st in stages:
            (op, arg), = st.items()
            if op == "$group":
                docs = _group(docs, arg)
            elif op == "$sort":
                for k, d in reversed(list(arg.items())):
                    docs.sort(key=lambda x: (_get(x, k) is not None, _get(x, k) if _get(x, k) is not None else 0), reverse=d < 0)
            elif op == "$limit":
                docs = docs[:arg]
            elif op == "$skip":
                docs = docs[arg:]
            elif op == "$match":
                docs = [d for d in docs if all(_get(d, k) == v for k, v in arg.items())]
            elif op == "$project":
                docs = [_project(d, arg) for d in docs]
            else:
                raise NotImplementedError(f"Stage {op} belum didukung")
        return docs[:length] if length else docs


def _val(doc, expr):
    if isinstance(expr, str) and expr.startswith("$"):
        return _get(doc, expr[1:])
    return expr


def _group(docs, spec):
    groups = {}
    for d in docs:
        key = _val(d, spec["_id"])
        if isinstance(spec["_id"], dict):
            key = {k: _val(d, v) for k, v in spec["_id"].items()}
        gk = _dumps(key)
        g = groups.setdefault(gk, {"_id": key, "__n": {}})
        for name, acc in spec.items():
            if name == "_id":
                continue
            (op, e), = acc.items()
            v = _val(d, e)
            if op == "$sum":
                g[name] = g.get(name, 0) + (v if isinstance(v, (int, float)) else 0)
            elif op == "$avg":
                if isinstance(v, (int, float)):
                    g["__n"][name] = g["__n"].get(name, 0) + 1
                    g[name] = g.get(name, 0) + v
            elif op == "$max":
                g[name] = v if name not in g or (v is not None and v > g[name]) else g[name]
            elif op == "$min":
                g[name] = v if name not in g or (v is not None and v < g[name]) else g[name]
            elif op == "$first":
                g.setdefault(name, v)
            elif op == "$last":
                g[name] = v
            elif op == "$push":
                g.setdefault(name, []).append(v)
            elif op == "$addToSet":
                lst = g.setdefault(name, [])
                if v not in lst:
                    lst.append(v)
    out = []
    for g in groups.values():
        for name, n in g.pop("__n").items():
            g[name] = g[name] / n if n else None
        out.append(g)
    return out


class Collection:
    def __init__(self, database, name):
        if not _NAME.match(name):
            raise ValueError(f"Nama koleksi tidak valid: {name}")
        self.database, self.name = database, name
        self.t = f'"{name}"'

    async def _pool(self):
        return await self.database._ensure(self.name)

    async def _select(self, flt, proj, sort, skip, limit, con=None, lock=False):
        P = _Params()
        sql = f"SELECT _id, doc FROM {self.t} WHERE {_where(flt, P)}{_order(sort, P)}"
        if limit:
            sql += f" LIMIT {int(limit)}"
        if skip:
            sql += f" OFFSET {int(skip)}"
        if lock:
            sql += " FOR UPDATE"
        if con is None:
            pool = await self._pool()
            rows = await pool.fetch(sql, *P.values)
        else:
            rows = await con.fetch(sql, *P.values)
        return [_project(_row(r), proj) for r in rows]

    def find(self, filter=None, projection=None, sort=None, limit=0):
        c = Cursor(self, filter or {}, projection)
        if sort:
            c.sort(sort)
        if limit:
            c.limit(limit)
        return c

    async def find_one(self, filter=None, projection=None, sort=None):
        docs = await self._select(filter or {}, projection, list(sort or []), 0, 1)
        return docs[0] if docs else None

    async def count_documents(self, filter=None, **_):
        P = _Params()
        pool = await self._pool()
        return await pool.fetchval(f"SELECT count(*) FROM {self.t} WHERE {_where(filter or {}, P)}", *P.values)

    async def estimated_document_count(self):
        return await self.count_documents({})

    async def distinct(self, key, filter=None):
        out = []
        for d in await self._select(filter or {}, None, [], 0, None):
            v = _get(d, key)
            for x in (v if isinstance(v, list) else [v]):
                if x is not None and x not in out:
                    out.append(x)
        return out

    async def insert_one(self, doc: dict):
        _id = str(doc.get("_id") or uuid.uuid4().hex)
        doc["_id"] = _id
        pool = await self._pool()
        await pool.execute(f"INSERT INTO {self.t} (_id, doc) VALUES ($1, $2::jsonb)", _id, _dumps(_clean(doc)))
        return SimpleNamespace(inserted_id=_id, acknowledged=True)

    async def insert_many(self, docs, **_):
        rows = []
        for d in docs:
            _id = str(d.get("_id") or uuid.uuid4().hex)
            d["_id"] = _id
            rows.append((_id, _dumps(_clean(d))))
        pool = await self._pool()
        async with pool.acquire() as con, con.transaction():
            await con.executemany(f"INSERT INTO {self.t} (_id, doc) VALUES ($1, $2::jsonb)", rows)
        return SimpleNamespace(inserted_ids=[r[0] for r in rows], acknowledged=True)

    async def _update(self, flt, upd, upsert, many, return_doc=None, projection=None):
        pool = await self._pool()
        async with pool.acquire() as con, con.transaction():
            if upsert:
                await con.execute("SELECT pg_advisory_xact_lock(hashtext($1))", self.name)
            docs = await self._select(flt, None, [], 0, None if many else 1, con=con, lock=True)
            if docs:
                modified, before, after = 0, docs[0], None
                for d in docs:
                    new = _apply_update({k: v for k, v in d.items() if k != "_id"}, upd, False)
                    new["_id"] = d["_id"]
                    after = after or new
                    if new != d:
                        modified += 1
                        await con.execute(f"UPDATE {self.t} SET doc = $2::jsonb WHERE _id = $1", d["_id"], _dumps(_clean(new)))
                res = SimpleNamespace(matched_count=len(docs), modified_count=modified, upserted_id=None, acknowledged=True)
                picked = after if return_doc else before
            elif upsert:
                new = _apply_update(_upsert_base(flt), upd, True)
                if not any(k.startswith("$") for k in upd):
                    new = {**_upsert_base(flt), **new}
                _id = str(new.pop("_id", None) or uuid.uuid4().hex)
                await con.execute(f"INSERT INTO {self.t} (_id, doc) VALUES ($1, $2::jsonb)", _id, _dumps(_clean(new)))
                res = SimpleNamespace(matched_count=0, modified_count=0, upserted_id=_id, acknowledged=True)
                picked = {"_id": _id, **new} if return_doc else None
            else:
                res = SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None, acknowledged=True)
                picked = None
        if return_doc is None:
            return res
        return _project(picked, projection) if picked else None

    async def update_one(self, filter, update, upsert=False, **_):
        return await self._update(filter, update, upsert, False)

    async def update_many(self, filter, update, upsert=False, **_):
        return await self._update(filter, update, upsert, True)

    async def replace_one(self, filter, replacement, upsert=False, **_):
        return await self._update(filter, {k: v for k, v in replacement.items() if k != "_id"}, upsert, False)

    async def find_one_and_update(self, filter, update, projection=None, upsert=False, return_document=False, **_):
        return await self._update(filter, update, upsert, False, return_doc=bool(return_document), projection=projection)

    async def find_one_and_delete(self, filter, projection=None, **_):
        doc = await self.find_one(filter)
        if doc:
            await self.delete_one({"_id": doc["_id"]})
        return _project(doc, projection) if doc else None

    async def delete_one(self, filter):
        P = _Params()
        pool = await self._pool()
        r = await pool.execute(f"DELETE FROM {self.t} WHERE _id = (SELECT _id FROM {self.t} WHERE {_where(filter, P)} LIMIT 1)", *P.values)
        return SimpleNamespace(deleted_count=int(r.split()[-1]), acknowledged=True)

    async def delete_many(self, filter):
        P = _Params()
        pool = await self._pool()
        r = await pool.execute(f"DELETE FROM {self.t} WHERE {_where(filter, P)}", *P.values)
        return SimpleNamespace(deleted_count=int(r.split()[-1]), acknowledged=True)

    def aggregate(self, pipeline, **_):
        return AggCursor(self, pipeline)

    async def create_index(self, keys, unique=False, **_):
        fields = [(keys, 1)] if isinstance(keys, str) else list(keys)
        names = [f for f, _d in fields]
        idx = f"{self.name}_{'_'.join(n.replace('.', '_') for n in names)}_{'u' if unique else 'i'}dx"[:63]
        cols = ", ".join("(doc #>> '{" + ",".join(n.split(".")) + "}')" for n in names)
        pool = await self._pool()
        try:
            await pool.execute(f'CREATE {"UNIQUE " if unique else ""}INDEX IF NOT EXISTS "{idx}" ON {self.t} ({cols})')
        except asyncpg.UniqueViolationError:
            await pool.execute(f'CREATE INDEX IF NOT EXISTS "{idx[:60]}_nu" ON {self.t} ({cols})')
        return idx

    async def drop(self):
        pool = await self.database._get_pool()
        await pool.execute(f"DROP TABLE IF EXISTS {self.t}")
        self.database._tables.discard(self.name)


class Database:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self._pool = None
        self._lock = None
        self._tables = set()
        self._cols = {}

    async def _get_pool(self):
        if self._pool is None:
            if self._lock is None:
                self._lock = asyncio.Lock()
            async with self._lock:
                if self._pool is None:
                    self._pool = await asyncpg.create_pool(self.dsn, min_size=1, max_size=10)
        return self._pool

    async def _ensure(self, name):
        pool = await self._get_pool()
        if name not in self._tables:
            await pool.execute(f'CREATE TABLE IF NOT EXISTS "{name}" (_id TEXT PRIMARY KEY, doc JSONB NOT NULL)')
            await pool.execute(f'CREATE INDEX IF NOT EXISTS "{name}_doc_gin" ON "{name}" USING GIN (doc jsonb_path_ops)')
            self._tables.add(name)
        return pool

    def __getitem__(self, name) -> Collection:
        if name not in self._cols:
            self._cols[name] = Collection(self, name)
        return self._cols[name]

    def __getattr__(self, name) -> Collection:
        if name.startswith("_"):
            raise AttributeError(name)
        return self[name]

    async def list_collection_names(self):
        pool = await self._get_pool()
        rows = await pool.fetch("SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'doc'")
        return sorted(r["table_name"] for r in rows)

    def close(self):
        if self._pool is not None:
            try:
                asyncio.get_event_loop().create_task(self._pool.close())
            except RuntimeError:
                pass
