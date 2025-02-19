.PHONY: lint
lint: setup
	bun x @biomejs/biome check

.PHONY: format
format: setup
	bun x @biomejs/biome check --write

# https://github.com/lgarron/repo
REPO_COMMANDS = publish

publish: setup

.PHONY: ${REPO_COMMANDS}
${REPO_COMMANDS}:
	repo $@

.PHONY: setup
setup:
	bun install --frozen-lockfile
