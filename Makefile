.PHONY: lint
lint:
	bun x @biomejs/biome check

.PHONY: format
format:
	bun x @biomejs/biome check --write

# https://github.com/lgarron/repo
REPO_COMMANDS = setup publish

${REPO_COMMANDS}:
	repo $@
