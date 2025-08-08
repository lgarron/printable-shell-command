.PHONY: build
build: setup
	bun run script/build.ts

.PHONY: test
test: lint test-js

.PHONY: lint
lint: setup lint-biome lint-tsc

.PHONY: lint-biome
lint-biome:
	bun x @biomejs/biome check

.PHONY: lint-tsc
lint-tsc:
	bun x tsc --project .

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
	cat node_modules/bun-types/globals.d.ts | tail +1011 | head -n 1
	cat node_modules/bun-types/globals.d.ts | tail +1287 | head -n 1

.PHONY: clean
clean:
	rm -rf ./dist/

.PHONY: reset
reset: clean
	rm -rf ./node_modules/
