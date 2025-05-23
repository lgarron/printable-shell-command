.PHONY: build
build: setup
	bun run script/build.ts

.PHONY: test
test: lint test-js

.PHONY: lint
lint: setup
	bun x @biomejs/biome check

.PHONY: format
format: setup
	bun x @biomejs/biome check --write

.PHONY: test-js
test-js: setup
	bun test

# https://github.com/lgarron/repo
REPO_COMMANDS = publish

publish: setup

.PHONY: ${REPO_COMMANDS}
${REPO_COMMANDS}:
	repo $@

.PHONY: setup
setup:
	bun install --frozen-lockfile

.PHONY: clean
clean:
	rm -rf ./dist/

.PHONY: reset
reset: clean
	rm -rf ./node_modules/
