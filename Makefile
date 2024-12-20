.PHONY: lint
lint: setup
	bun x @biomejs/biome check

.PHONY: format
format: setup
	bun x @biomejs/biome check --write

# https://github.com/lgarron/repo
REPO_COMMANDS = setup publish

publish: setup

${REPO_COMMANDS}:
	repo $@
