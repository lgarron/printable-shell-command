.PHONY: build
build: setup
	bun run script/build.ts

.PHONY: check
check: lint test build check-package.json

.PHONY: test
test: test-js lint

.PHONY: lint
lint: setup lint-biome lint-tsc

.PHONY: lint-biome
lint-biome: setup
	bun x -- bun-dx --package @biomejs/biome biome -- check
	bun x -- bun-dx --package readme-cli-help readme-cli-help -- check

.PHONY: lint-tsc
lint-tsc: setup
	bun x -- bun-dx --package typescript tsc -- --project .

.PHONY: check-package.json
check-package.json: build
	bun x --package @cubing/dev-config package.json check

.PHONY: format
format: setup
	bun x -- bun-dx --package @biomejs/biome biome -- check --write
	bun x -- bun-dx --package readme-cli-help readme-cli-help -- update

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

.PHONY: prepublishOnly
prepublishOnly: clean check build

