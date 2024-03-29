SRC_FILES := $(shell find src -name '*.ts')
BIN := ./node_modules/.bin

lib: ${SRC_FILES} package.json tsconfig.json node_modules rollup.config.js
	@${BIN}/rollup -c && touch lib

.PHONY: test
test: node_modules
	@TS_NODE_PROJECT='./test/tsconfig.json' ${BIN}/mocha \
		-u tdd -r ts-node/register --extension ts test/*.ts --grep '$(grep)'

.PHONY: coverage
coverage: node_modules
	@TS_NODE_PROJECT='./test/tsconfig.json' ${BIN}/nyc --reporter=html \
		${BIN}/mocha -u tdd -r ts-node/register --extension ts test/*.ts \
		-R nyan && open coverage/index.html

.PHONY: lint
lint: node_modules
	@${BIN}/eslint src --ext .ts --fix

.PHONY: ci-test
ci-test: node_modules
	@TS_NODE_PROJECT='./test/tsconfig.json' ${BIN}/nyc --reporter=text \
		${BIN}/mocha -u tdd -r ts-node/register --extension ts test/*.ts -R list

.PHONY: ci-lint
ci-lint: node_modules
	@${BIN}/eslint src --ext .ts --max-warnings 0 --format unix && echo "Ok"

docs: $(SRC_FILES) node_modules
	@${BIN}/typedoc --out docs \
		--excludeInternal --excludePrivate --excludeProtected \
		--includeVersion --readme none \
		src/index.ts

.PHONY: deploy-pages
deploy-pages: docs
	@${BIN}/gh-pages -d docs

.PHONY: publish
publish: | distclean node_modules
	@git diff-index --quiet HEAD || (echo "Uncommitted changes, please commit first" && exit 1)
	@git fetch origin && git diff origin/master --quiet || (echo "Changes not pushed to origin, please push first" && exit 1)
	@yarn config set version-tag-prefix "" && yarn config set version-git-message "Version %s"
	@yarn publish && git push && git push --tags

node_modules:
	yarn install --non-interactive --frozen-lockfile --ignore-scripts

.PHONY: clean
clean:
	rm -rf lib/ coverage/ docs/

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
