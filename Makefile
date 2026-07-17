.PHONY: run build test

run:
	npm start

build:
	npm run make -- --arch=arm64

test:
	npm test

upload:
	./scripts/upload_binary.sh
