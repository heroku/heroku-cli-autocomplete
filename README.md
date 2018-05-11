@heroku-cli/plugin-autocomplete
===============================



[![Version](https://img.shields.io/npm/v/@heroku-cli/plugin-autocomplete.svg)](https://npmjs.org/package/@heroku-cli/plugin-autocomplete)
[![CircleCI](https://circleci.com/gh/heroku/heroku-cli-autocomplete/tree/master.svg?style=shield)](https://circleci.com/gh/heroku/heroku-cli-autocomplete/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/heroku/heroku-cli-autocomplete?branch=master&svg=true)](https://ci.appveyor.com/project/heroku/heroku-cli-autocomplete/branch/master)
[![Codecov](https://codecov.io/gh/heroku/heroku-cli-autocomplete/branch/master/graph/badge.svg)](https://codecov.io/gh/heroku/heroku-cli-autocomplete)
[![Downloads/week](https://img.shields.io/npm/dw/@heroku-cli/plugin-autocomplete.svg)](https://npmjs.org/package/@heroku-cli/plugin-autocomplete)
[![License](https://img.shields.io/npm/l/@heroku-cli/plugin-autocomplete.svg)](https://github.com/heroku/heroku-cli-autocomplete/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ heroku plugins:install @heroku-cli/plugin-autocomplete
$ heroku autocomplete
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`heroku autocomplete [SHELL]`](#heroku-autocomplete-shell)

## `heroku autocomplete [SHELL]`

display autocomplete instructions

```
USAGE
  $ heroku autocomplete [SHELL]

ARGUMENTS
  SHELL  shell type

OPTIONS
  -s, --skip-instructions  Do not show installation instructions

EXAMPLES
  $ heroku autocomplete

  $ heroku autocomplete bash

  $ heroku autocomplete zsh
```

_See code: [src/commands/autocomplete.ts](https://github.com/heroku/heroku-cli-autocomplete/blob/v0.0.0/src/commands/autocomplete.ts)_
<!-- commandsstop -->
