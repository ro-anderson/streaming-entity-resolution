import argparse

from app.clients.elastic_client import build_elastic_client
from app.clients.openai_client import build_openai_client
from app.config import get_settings
from app.consumers.signal_consumer import SignalConsumer
from app.producers.jsonl_signal_producer import JsonlSignalProducer
from app.repositories.elastic_entity_repository import ElasticEntityRepository
from app.repositories.memory_review_repository import MemoryReviewRepository
from app.repositories.trace_recorder import JsonlTraceRecorder
from app.services.entity_service import EntityService
from app.services.export_service import export
from app.services.extraction_service import ExtractionService
from app.services.resolution_service import ResolutionService
from app.types.signal import Tenant


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset-only", action="store_true")
    arguments = parser.parse_args()
    settings = get_settings()
    tenant = Tenant.model_validate_json(settings.tenant_path.read_text(encoding="utf-8"))
    repository = ElasticEntityRepository(
        client=build_elastic_client(settings=settings), index_prefix=settings.index_prefix
    )
    entities = EntityService(repository=repository)
    repository.reset()
    entities.seed_tenant(tenant=tenant)
    if arguments.reset_only:
        print("indices recreated and tenant seeded")
        return
    llm = build_openai_client(settings=settings)
    reviews = MemoryReviewRepository()
    consumer = SignalConsumer(
        extraction=ExtractionService(llm=llm, model=settings.extraction_model, tenant=tenant),
        resolution=ResolutionService(
            repository=repository,
            entities=entities,
            reviews=reviews,
            trace=JsonlTraceRecorder(path=settings.out_dir / "trace.jsonl"),
            llm=llm,
            model=settings.decision_model,
            threshold=settings.match_threshold,
            search_size=settings.search_size,
            tenant=tenant,
        ),
        repository=repository,
        reviews=reviews,
    )
    for signal in JsonlSignalProducer(path=settings.signals_path).signals():
        entities_before = len(repository.all())
        reviews_before = len(reviews.all())
        consumer.handle(signal=signal)
        created = len(repository.all()) - entities_before
        reviewed = len(reviews.all()) - reviews_before
        print(f"{signal.id}: +{created} entities, +{reviewed} reviews", flush=True)
    export(entities=repository.all(), reviews=reviews.all(), out_dir=settings.out_dir)
    print(f"{len(repository.all())} entities, {len(reviews.all())} reviews -> {settings.out_dir}")


if __name__ == "__main__":
    main()
