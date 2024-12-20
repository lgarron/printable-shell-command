.PHONY: lint
lint:
	bun x @biomejs/biome check

.PHONY: format
format:
	bun x @biomejs/biome check --write
