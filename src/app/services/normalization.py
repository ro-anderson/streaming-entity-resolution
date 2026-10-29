import re
import unicodedata

from app.types.signal import Contact

PERSONAL_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "hotmail.com",
        "outlook.com",
        "live.com",
        "yahoo.com",
        "yahoo.com.br",
        "icloud.com",
        "bol.com.br",
        "uol.com.br",
        "terra.com.br",
    }
)
BOT_MARKERS = ("notes", "read.ai", "bot", "notetaker")
SPEAKER_PLACEHOLDER = re.compile(r"^speaker \d+$")
TOKEN_SPLIT = re.compile(r"[^0-9a-z]+")


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(char for char in decomposed if not unicodedata.combining(char)).lower()


def normalize(text: str) -> str:
    return " ".join(fold(text).split())


def tokens(text: str) -> list[str]:
    return [token for token in TOKEN_SPLIT.split(normalize(text)) if token]


def domain_of(email: str) -> str:
    return normalize(email).rsplit("@", 1)[-1]


def is_personal_domain(domain: str) -> bool:
    return normalize(domain) in PERSONAL_DOMAINS


def is_speaker_placeholder(name: str) -> bool:
    return SPEAKER_PLACEHOLDER.match(normalize(name)) is not None


def is_bot(contact: Contact) -> bool:
    name = normalize(contact.name)
    return contact.email is None and any(marker in name for marker in BOT_MARKERS)


def fold_with_index(text: str) -> tuple[str, list[int]]:
    folded_chars: list[str] = []
    origins: list[int] = []
    for index, char in enumerate(text):
        for folded_char in fold(char):
            folded_chars.append(folded_char)
            origins.append(index)
    return "".join(folded_chars), origins


def find_original_span(*, haystack: str, needle: str) -> str | None:
    target = normalize(needle)
    if not target:
        return None
    folded, origins = fold_with_index(haystack)
    pattern = re.compile(
        r"(?<![0-9a-z])" + re.escape(target).replace(r"\ ", r"\s+") + r"(?![0-9a-z])"
    )
    found = pattern.search(folded)
    if found is None:
        return None
    return haystack[origins[found.start()] : origins[found.end() - 1] + 1]
