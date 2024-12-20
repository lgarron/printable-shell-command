.PHONY: lint
lint: setup
	bun x @biomejs/biome check

.PHONY: format
format: setup
	bun x @biomejs/biome check --write

# https://github.com/lgarron/repo
REPO_COMMANDS = publish

publish: setup

${REPO_COMMANDS}:
	repo $@

setup:
	bun install --no-save
