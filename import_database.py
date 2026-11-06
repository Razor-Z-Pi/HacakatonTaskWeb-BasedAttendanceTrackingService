import json, sqlite3
from datetime import datetime

schedule = json.load(open("526sched.json", encoding="utf-8"))
groups   = json.load(open("526group.json", encoding="utf-8"))

con = sqlite3.connect("sibit_wincore.db")
con.execute("PRAGMA foreign_keys = ON")
cur = con.cursor()

cur.executescript("""
CREATE TABLE groups (
    group_name TEXT PRIMARY KEY
);

CREATE TABLE students (
    student_id TEXT PRIMARY KEY,
    fio TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('м','ж')),
    group_name TEXT NOT NULL REFERENCES groups(group_name),
    is_head INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE slots (
    slot_no INTEGER PRIMARY KEY,
    time_range TEXT NOT NULL
);

CREATE TABLE teachers (
    id INTEGER PRIMARY KEY,
    fio TEXT NOT NULL UNIQUE
);

CREATE TABLE lessons (
    id INTEGER PRIMARY KEY,
    lesson_date TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    weekday INTEGER NOT NULL,
    slot_no INTEGER NOT NULL REFERENCES slots(slot_no),
    subject TEXT NOT NULL,
    teacher_id INTEGER REFERENCES teachers(id),
    auditory TEXT,
    type_lesson TEXT
);

CREATE TABLE lesson_groups (
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    group_name TEXT NOT NULL REFERENCES groups(group_name),
    PRIMARY KEY (lesson_id, group_name)
);

CREATE TABLE attendance (
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    student_id TEXT NOT NULL REFERENCES students(student_id),
    status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
    marked_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lesson_id, student_id)
);

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    login TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','teacher','head','student')),
    student_id TEXT REFERENCES students(student_id) DEFAULT NULL,
    teacher_id INTEGER REFERENCES teachers(id) DEFAULT NULL
);
""")

cur.executemany("INSERT INTO groups VALUES (?)",
                [(g,) for g in groups["groups"]])

cur.executemany(
    "INSERT INTO students VALUES (?,?,?,?,?)",
    [(s["student_id"], s["fio"], s["gender"], s["group"], int(s["is_head"]))
     for s in groups["students"]])

cur.executemany("INSERT INTO slots VALUES (?,?)",
                [(int(k), v) for k, v in schedule["slots"].items()])

teachers_fio = set()
for week in schedule["schedule"]:
    for day in week["days"]:
        for l in (day["lessons"] or []):
            if l.get("teacher"):
                teachers_fio.add(l["teacher"])

fio_to_id = {}
for fio in sorted(teachers_fio):
    cur.execute("INSERT OR IGNORE INTO teachers(fio) VALUES (?)", (fio,))
    cur.execute("SELECT id FROM teachers WHERE fio = ?", (fio,))
    fio_to_id[fio] = cur.fetchone()[0]

for week in schedule["schedule"]:
    date_by_wd = {
        d["weekday"]: datetime.strptime(d["date"], "%d.%m.%Y").date().isoformat()
        for d in week["dates"]["dates"]
    }
    for day in week["days"]:
        if day["weekday"] not in date_by_wd:
            continue
        for l in (day["lessons"] or []):
            cur.execute(
                "INSERT OR IGNORE INTO lessons VALUES (?,?,?,?,?,?,?,?,?)",
                (l["id"], date_by_wd[day["weekday"]], day["week_number"],
                 day["weekday"], l["time"], l["subject"],
                 fio_to_id.get(l["teacher"]),
                 l["auditory"], l["type_lesson"]))
            for g in l["group"]:
                cur.execute("INSERT OR IGNORE INTO lesson_groups VALUES (?,?)",
                            (l["id"], g))

con.commit()
for t in ("groups","students","slots","teachers","lessons","lesson_groups"):
    print(f"{t:14}", cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
con.close()
