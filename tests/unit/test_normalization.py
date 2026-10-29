from app.config import get_settings
from app.services.normalization import (
    domain_of,
    find_original_span,
    is_bot,
    is_personal_domain,
    is_speaker_placeholder,
    normalize,
    strip_leading_article,
    tokens,
)
from app.types.signal import Contact, Signal


def test_normalize_strips_accents_case_and_spaces() -> None:
    assert normalize("  Rodobrás   LTDA ") == "rodobras ltda"


def test_tokens_split_on_punctuation() -> None:
    assert tokens("Carlos M.") == ["carlos", "m"]


def test_tokens_of_blank_text_is_empty() -> None:
    assert tokens("  ") == []


def test_domain_of_lowercases() -> None:
    assert domain_of("Pedro.Nogueira@Caravela.IO") == "caravela.io"


def test_personal_domain_detected() -> None:
    assert is_personal_domain("gmail.com")
    assert not is_personal_domain("translog.com.br")


def test_speaker_placeholder_detected() -> None:
    assert is_speaker_placeholder("Speaker 3")
    assert is_speaker_placeholder("speaker 12")
    assert not is_speaker_placeholder("Speaker Lima")
    assert not is_speaker_placeholder("Fernanda Lima")


def test_bot_detected_only_without_email() -> None:
    assert is_bot(Contact(name="Read.ai Meeting Notes", email=None))
    assert not is_bot(Contact(name="Juliana Freitas", email="juliana@caravela.com.br"))


def test_find_original_span_ignores_case_and_accents() -> None:
    haystack = "eu conheço a fernanda de lá e a rodobrás"
    assert find_original_span(haystack=haystack, needle="Fernanda") == "fernanda"
    assert find_original_span(haystack=haystack, needle="Rodobras") == "rodobrás"


def test_find_original_span_keeps_exact_original_text() -> None:
    haystack = "Fechei a call com a Translog hoje. O Carlos confirmou"
    assert find_original_span(haystack=haystack, needle="carlos") == "Carlos"


def test_find_original_span_requires_word_boundaries() -> None:
    assert find_original_span(haystack="o carlinhos chegou", needle="Carlos") is None
    assert find_original_span(haystack="a translogue ligou", needle="Translog") is None


def test_find_original_span_returns_none_when_absent() -> None:
    assert find_original_span(haystack="nada aqui", needle="Carlinhos") is None


def test_signals_file_parses_into_57_signals() -> None:
    lines = get_settings().signals_path.read_text(encoding="utf-8").splitlines()
    assert len([Signal.model_validate_json(line) for line in lines]) == 57


def test_strip_leading_article_removes_portuguese_articles() -> None:
    assert strip_leading_article("O Carlos") == "Carlos"
    assert strip_leading_article("a Lume") == "Lume"
    assert strip_leading_article("os Pedros") == "Pedros"


def test_strip_leading_article_keeps_names_starting_with_article_letters() -> None:
    assert strip_leading_article("Ana Lima") == "Ana Lima"
    assert strip_leading_article("Otávio") == "Otávio"
    assert strip_leading_article("O") == "O"
