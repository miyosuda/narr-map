.PHONY: run build

run:
	npm start

build:
	npm run make -- --arch=arm64
