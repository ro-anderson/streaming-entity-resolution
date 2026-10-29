from app.services.decision_rules import accepts_match, choose_name, has_anchor, violates_guards
from app.types.decision import CandidateDecision
from app.types.entity import Entity
from app.types.observation import Observation

THRESHOLD = 0.85


def person(*, name: str, email: str | None = None, role: str | None = None) -> Observation:
    return Observation(kind="PERSON", name=name, surfaces=[name], email=email, role=role)


def candidate(*, emails: list[str] | None = None, org_id: str | None = None) -> Entity:
    return Entity(id="e_001", kind="PERSON", name="Pedro", emails=emails or [], org_id=org_id)


def decision(
    *, kind: str = "match", candidate_id: str | None, confidence: float
) -> CandidateDecision:
    return CandidateDecision.model_validate(
        {
            "decision": kind,
            "candidate_id": candidate_id,
            "confidence": confidence,
            "reason": "",
            "description": "",
        }
    )


def test_guard_blocks_different_emails() -> None:
    observation = person(name="Pedro Almeida", email="pedro.almeida@caravela.com.br")
    target = candidate(emails=["pedro.nogueira@caravela.io"])
    assert violates_guards(observation=observation, org_id=None, candidate=target)


def test_guard_allows_same_email_with_different_case() -> None:
    observation = person(name="Pedro", email="Pedro.Nogueira@Caravela.io")
    target = candidate(emails=["pedro.nogueira@caravela.io"])
    assert not violates_guards(observation=observation, org_id=None, candidate=target)


def test_guard_allows_candidate_without_email() -> None:
    observation = person(name="Fernanda Okada", email="fernanda.okada@bancoaurora.com.br")
    assert not violates_guards(observation=observation, org_id=None, candidate=candidate())


def test_guard_blocks_different_org_ids() -> None:
    observation = person(name="Fernanda")
    target = candidate(org_id="e_010")
    assert violates_guards(observation=observation, org_id="e_020", candidate=target)


def test_guard_allows_when_one_org_id_missing() -> None:
    observation = person(name="Fernanda")
    assert not violates_guards(observation=observation, org_id="e_020", candidate=candidate())
    target = candidate(org_id="e_010")
    assert not violates_guards(observation=observation, org_id=None, candidate=target)


def test_accepts_match_at_threshold() -> None:
    accepted = decision(candidate_id="e_001", confidence=0.85)
    assert accepts_match(decision=accepted, candidate_ids={"e_001"}, threshold=THRESHOLD)


def test_rejects_match_below_threshold() -> None:
    rejected = decision(candidate_id="e_001", confidence=0.84)
    assert not accepts_match(decision=rejected, candidate_ids={"e_001"}, threshold=THRESHOLD)


def test_rejects_match_with_unknown_candidate_id() -> None:
    rejected = decision(candidate_id="e_999", confidence=0.99)
    assert not accepts_match(decision=rejected, candidate_ids={"e_001"}, threshold=THRESHOLD)


def test_rejects_new_and_ambiguous() -> None:
    for kind in ("new", "ambiguous"):
        rejected = decision(kind=kind, candidate_id="e_001", confidence=0.99)
        assert not accepts_match(decision=rejected, candidate_ids={"e_001"}, threshold=THRESHOLD)


def test_first_name_alone_has_no_anchor() -> None:
    assert not has_anchor(observation=person(name="Pedro"), org_id=None)


def test_first_name_with_org_or_role_has_anchor() -> None:
    assert has_anchor(observation=person(name="Fernanda"), org_id="e_010")
    assert has_anchor(observation=person(name="Fernanda", role="gerente"), org_id=None)


def test_full_name_or_email_has_anchor() -> None:
    assert has_anchor(observation=person(name="Luiz Barreto"), org_id=None)
    assert has_anchor(observation=person(name="Bia", email="bia@caravela.com.br"), org_id=None)


def test_organization_always_has_anchor() -> None:
    observation = Observation(kind="ORGANIZATION", name="Translog", surfaces=["Translog"])
    assert has_anchor(observation=observation, org_id=None)


def test_choose_name_upgrades_nickname_prefix() -> None:
    assert choose_name(current="Jo", incoming="Joana Prates") == "Joana Prates"


def test_choose_name_upgrades_initial() -> None:
    assert choose_name(current="Carlos M.", incoming="Carlos Menezes") == "Carlos Menezes"


def test_choose_name_upgrades_first_name() -> None:
    assert choose_name(current="Fernanda", incoming="Fernanda Okada") == "Fernanda Okada"


def test_choose_name_keeps_current_for_unrelated_name() -> None:
    assert choose_name(current="Bia Ramos", incoming="Beatriz Ramos") == "Bia Ramos"


def test_choose_name_never_downgrades() -> None:
    assert choose_name(current="Joana Prates", incoming="Jo") == "Joana Prates"
    assert choose_name(current="Carlos Menezes", incoming="carlos menezes") == "Carlos Menezes"


def test_choose_name_requires_token_order() -> None:
    assert choose_name(current="Prates Joana", incoming="Joana Prates Silva") == "Prates Joana"
