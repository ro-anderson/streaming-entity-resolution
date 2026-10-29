.PHONY: up down install reset run run-no-cache check test lint help

SHELL=/bin/bash

ifeq ($(shell docker compose version 2>/dev/null),)
  DOCKER_COMPOSE := docker-compose
else
  DOCKER_COMPOSE := docker compose
endif

## Start Elasticsearch and wait until it is healthy
up:
	$(DOCKER_COMPOSE) up -d --wait

## Stop Elasticsearch
down:
	$(DOCKER_COMPOSE) down

## Install dependencies
install:
	uv sync

## Recreate the indices and seed the tenant
reset:
	uv run python -m app.main --reset-only

## Process every signal and export out/entities.json and out/needs_review.json
run:
	uv run python -m app.main

## Same as run, ignoring the LLM cache
run-no-cache:
	LLM_CACHE_ENABLED=false uv run python -m app.main

## Validate the critical invariants of out/entities.json
check:
	uv run python -m app.check

## Run unit tests
test:
	uv run pytest tests/unit

## Lint, format check and type check
lint:
	uv run ruff check .
	uv run ruff format --check .
	-uv run mypy

## Display help information
help:
	@echo "Available commands:"
	@echo "  make up            - Start Elasticsearch and wait until it is healthy"
	@echo "  make down          - Stop Elasticsearch"
	@echo "  make install       - Install dependencies"
	@echo "  make reset         - Recreate the indices and seed the tenant"
	@echo "  make run           - Process every signal and export the JSON files"
	@echo "  make run-no-cache  - Same as run, ignoring the LLM cache"
	@echo "  make check         - Validate the critical invariants of the output"
	@echo "  make test          - Run unit tests"
	@echo "  make lint          - Lint, format check and type check"

.DEFAULT_GOAL := help
