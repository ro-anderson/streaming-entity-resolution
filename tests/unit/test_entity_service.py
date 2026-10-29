from app.services.entity_service import with_revision
from app.types.entity import Entity, Revision


def luiz(*, description: str, revisions: list[Revision]) -> Entity:
    return Entity(
        id="e_005",
        kind="PERSON",
        name="Luiz Barreto",
        description=description,
        revisions=revisions,
    )


def test_second_change_in_the_same_signal_replaces_its_revision() -> None:
    first = Revision(signal_id="s_021", name="Luiz Barreto", description="Diretor.")
    before = luiz(description="Diretor.", revisions=[first])
    after = luiz(description="Diretor; cuida da expansão.", revisions=[first])
    updated = with_revision(before=before, after=after, signal_id="s_021")
    assert [revision.signal_id for revision in updated.revisions] == ["s_021"]
    assert updated.revisions[0].description == "Diretor; cuida da expansão."


def test_change_in_a_new_signal_appends_a_revision() -> None:
    first = Revision(signal_id="s_001", name="Luiz Barreto", description="Diretor.")
    before = luiz(description="Diretor.", revisions=[first])
    after = luiz(description="Diretor; cuida da expansão.", revisions=[first])
    updated = with_revision(before=before, after=after, signal_id="s_021")
    assert [revision.signal_id for revision in updated.revisions] == ["s_001", "s_021"]


def test_no_change_adds_no_revision() -> None:
    first = Revision(signal_id="s_001", name="Luiz Barreto", description="Diretor.")
    before = luiz(description="Diretor.", revisions=[first])
    assert with_revision(before=before, after=before, signal_id="s_021").revisions == [first]
