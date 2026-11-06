import re

TRANSLIT = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "h",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "sch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


def transliterate(value: str) -> str:
    return "".join(TRANSLIT.get(char.lower(), char.lower()) for char in value)


def make_teacher_login(fio: str) -> str:
    """Соснин Е.А. -> sosnin.ea"""
    parts = fio.split()
    if not parts:
        return "teacher"
    surname = re.sub(r"[^a-z0-9]", "", transliterate(parts[0]))
    initials = re.sub(
        r"[^a-z0-9]",
        "",
        transliterate("".join(part for part in parts[1:] if part.strip("."))),
    )
    return f"{surname}.{initials}" if initials else surname or "teacher"
