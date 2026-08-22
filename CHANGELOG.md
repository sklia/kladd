# Changelog

## [0.2.0](https://github.com/sklia/kladd/compare/v0.1.3...v0.2.0) (2026-08-22)


### Features

* paste intelligence (v0.2) ([#6](https://github.com/sklia/kladd/issues/6)) ([001aae0](https://github.com/sklia/kladd/commit/001aae0ff9447e363e20042884f355efe8a87e33))

## [0.1.3](https://github.com/sklia/kladd/compare/v0.1.2...v0.1.3) (2026-08-10)


### Bug Fixes

* update to app-specific password ([dc19690](https://github.com/sklia/kladd/commit/dc19690071765f8c24075517baf1c999499c4644))

## [0.1.2](https://github.com/sklia/kladd/compare/v0.1.1...v0.1.2) (2026-08-09)


### Bug Fixes

* **ci:** pass toolchain as explicit input to rust-toolchain action ([1ee58d5](https://github.com/sklia/kladd/commit/1ee58d56e75c6f6363637112f10b4e567dc62899))

## [0.1.1](https://github.com/sklia/kladd/compare/v0.1.0...v0.1.1) (2026-08-09)


### Bug Fixes

* **ci:** dispatch release build since token-created tags skip triggers ([4d772f5](https://github.com/sklia/kladd/commit/4d772f50ed18b9cd69f7d7356aa32ffe65e5ec2c))

## 0.1.0 (2026-08-09)

### Features

- add auto-updater and release-please automation ([e70f9f5](https://github.com/sklia/kladd/commit/e70f9f5a43f6635e7460bf79c428bea2df1ccbce))
- add autosave with debounced disk watch and reload sync ([13c52c1](https://github.com/sklia/kladd/commit/13c52c14425b4a1089ef3654a4e03bd8bacb2c4c))
- add file ops, settings panel, and full keyboard tree nav ([1c5e9fd](https://github.com/sklia/kladd/commit/1c5e9fd9feeccd316883c21736558129f521b084))
- derive file titles from content and add tree drag-to-move ([ad695bd](https://github.com/sklia/kladd/commit/ad695bda4bba7ef768857bfc9aa766bf5c7a8806))
- **editor:** add frontmatter, callouts, tables, search, and raw mode ([a8df359](https://github.com/sklia/kladd/commit/a8df359003df2216d16eec4d965f0fac10f78561))
- **spike:** scaffold vite/react/codemirror markdown editor spike ([437dd75](https://github.com/sklia/kladd/commit/437dd75e842098814f912117b73e37f2b87bdf31))

### Code Refactoring

- **spike:** extract editor widgets and test live preview decoration ([74061be](https://github.com/sklia/kladd/commit/74061becbebcfd3623a370bb744d8b7de3fc8a72))

### Documentation

- add motion principles and design token notes ([e166970](https://github.com/sklia/kladd/commit/e166970db3cdd1ab6084080cecdb0b10d1e2c291))
- add project plan for md editor ([5b72454](https://github.com/sklia/kladd/commit/5b724547efe8d32df49ba948422c484dfc610c05))
- expand dependency policy and add foundation section to plan ([5ae597b](https://github.com/sklia/kladd/commit/5ae597b377aca7e06f9d94021b8d1b50a9248485))
- note full keyboard navigation goal ([fdc9d9d](https://github.com/sklia/kladd/commit/fdc9d9d7f075870f270b4d630cb50b7271bd6349))
- rename project to kladd ([b4ce28f](https://github.com/sklia/kladd/commit/b4ce28fbfaa527facfb6795e31a4960c19d293ed))

### CI

- add dependabot config and pin action refs to commit SHAs ([1d304f6](https://github.com/sklia/kladd/commit/1d304f6e21966f699b9bcd08257a49e0014a7b06))
- **codeql:** run only on weekly schedule ([12518ef](https://github.com/sklia/kladd/commit/12518ef46e18de1c29ee512ef9e83084d1115b5c))
- merge CI into one job, drop CodeQL for private repo ([20723c2](https://github.com/sklia/kladd/commit/20723c22b292b0a031938da8bbb395679c300f09))
