# Development guidelines

## Development 101

Pre-requisites:

* Oldest supported [NodeJS](https://nodejs.org) with NPM

Install dependencies:

```sh
npm install
```

Format your code changes:

```sh
npm run format
```

Run tests:

```sh
npm run test
```

## Run the CI locally

Pre-requisites:

* [Act](https://github.com/nektos/act)
* Docker/Podman to run the runner container

Run the validation workflow locally:

```sh
act pull_request
```
