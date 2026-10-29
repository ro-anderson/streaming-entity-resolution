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
LEADING_ARTICLE = re.compile(r"^(?:o|a|os|as)\s+(?=\S)", re.IGNORECASE)


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(char for char in decomposed if not unicodedata.combining(char)).lower()


def normalize(text: str) -> str:
    return " ".join(fold(text).split())


def tokens(text: str) -> list[str]:
    return [token for token in TOKEN_SPLIT.split(normalize(text)) if token]


def strip_leading_article(text: str) -> str:
    return LEADING_ARTICLE.sub("", text.strip(), count=1)


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


MIN_FUZZY_TOKEN = 4
MAX_SPLIT_OVERFLOW = 2
TOKEN_PATTERN = re.compile(r"[0-9a-z]+")


def within_one_edit(*, left: str, right: str) -> bool:
    if abs(len(left) - len(right)) > 1:
        return False
    if len(left) > len(right):
        left, right = right, left
    for index in range(len(right)):
        if index >= len(left) or left[index] != right[index]:
            same_length = len(left) == len(right)
            rest_left = left[index + 1 :] if same_length else left[index:]
            return rest_left == right[index + 1 :]
    return True


def is_compatible_token(*, token: str, name_tokens: list[str]) -> bool:
    for name_token in name_tokens:
        if token == name_token or name_token.startswith(token):
            return True
        fuzzy = len(token) >= MIN_FUZZY_TOKEN and len(name_token) >= MIN_FUZZY_TOKEN
        if fuzzy and within_one_edit(left=token, right=name_token):
            return True
    return False


def continues_split_token(*, previous: str, token: str, name_tokens: list[str]) -> bool:
    joined = previous + token
    return any(
        name_token != previous
        and name_token.startswith(previous)
        and len(joined) <= len(name_token) + MAX_SPLIT_OVERFLOW
        for name_token in name_tokens
    )


def trim_to_name(*, surface: str, name: str) -> str | None:
    name_tokens = tokens(name)
    folded, origins = fold_with_index(surface)
    found = [
        (match.group(), match.start(), match.end()) for match in TOKEN_PATTERN.finditer(folded)
    ]
    compatible: list[bool] = []
    for index, (token, _, _) in enumerate(found):
        continues = (
            index > 0
            and compatible[index - 1]
            and continues_split_token(
                previous=found[index - 1][0], token=token, name_tokens=name_tokens
            )
        )
        attached = len(token) > 1 or (index > 0 and compatible[index - 1])
        matches = attached and is_compatible_token(token=token, name_tokens=name_tokens)
        compatible.append(continues or matches)
    kept = [position for position, flag in zip(found, compatible, strict=True) if flag]
    if not kept:
        return None
    start = origins[kept[0][1]]
    end = origins[kept[-1][2] - 1] + 1
    return surface[start:end]
