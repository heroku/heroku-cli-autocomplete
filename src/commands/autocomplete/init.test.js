// @flow

import AutocompleteCacheBase from './init'
import os from 'os'
import cli from 'cli-ux'
import Command from 'cli-engine-command'
import {flags} from 'cli-engine-heroku'
import path from 'path'

const FooPlugin = require('../../../test/roots/foo-plugin')
const AC_PLUGIN_PATH = path.join(__dirname, '..', '..', '..')

class AutocompleteCache extends AutocompleteCacheBase {
  static flags = {
    'skip-ellipsis': flags.boolean({description: 'Do not add an ellipsis to zsh autocomplete setup', char: 'e'}),
    visable: flags.boolean({description: 'Visable flag', char: 'v'}),
    hidden: flags.boolean({description: 'Hidden flag', char: 'h', hidden: true})
  }

  get completionsCachePath () {
    return './tmp'
  }
}

// autocomplete will throw error on windows
let runtest = (os.platform() === 'windows' || os.platform() === 'win32') ? xtest : test

cli.config.mock = true

describe('AutocompleteCache', () => {
  describe('flags', () => {
    runtest('--skip-ellipsis', async () => {
      let cmd = await AutocompleteCache.mock('--skip-ellipsis')
      expect(cmd.flags['skip-ellipsis']).toBe(true)
      cmd = await AutocompleteCache.mock('-e')
      expect(cmd.flags['skip-ellipsis']).toBe(true)
    })
  })

  // Unit test private methods for extra coverage
  describe('private methods', () => {
    let cmd
    beforeAll(() => {
      cmd = new AutocompleteCache()
      cmd.plugins = [FooPlugin]
    })

    runtest('#_genCmdID', async () => {
      expect(cmd._genCmdID(AutocompleteCache)).toBe('autocomplete:cache')
    })

    runtest('#_genCmdWithDescription', async () => {
      expect(await cmd._genCmdWithDescription(AutocompleteCache)).toBe(`"autocomplete\\:cache":"autocomplete cache builder"`)
    })

    runtest('#_genCmdPublicFlags', async () => {
      expect(cmd._genCmdPublicFlags(AutocompleteCache)).toBe('--skip-ellipsis --visable')
      expect(cmd._genCmdPublicFlags(Command)).toBe('')
    })

    runtest('#_genCmdsCacheStrings (cmdsWithFlags)', async () => {
      const cacheStrings = await cmd._genCmdsCacheStrings()
      expect(cacheStrings.cmdsWithFlags).toBe('foo:alpha --bar\nfoo:beta')
    })

    runtest('#_genCmdsCacheStrings (cmdFlagsSetters)', async () => {
      const cacheStrings = await cmd._genCmdsCacheStrings()
      expect(cacheStrings.cmdFlagsSetters).toBe(`_set_foo_alpha_flags () {
_flags=(
"--bar[(switch) bar flag]"
)
}

# no flags for foo:beta`)
    })

    runtest('#_genCmdsCacheStrings (cmdsWithDescSetter)', async () => {
      const cacheStrings = await cmd._genCmdsCacheStrings()
      expect(cacheStrings.cmdsWithDescSetter).toBe(`
_set_all_commands_list () {
_all_commands_list=(
"foo\\:alpha":"foo:alpha description"
"foo\\:beta":"foo:beta description"
)
}
`)
    })

    runtest('#_genCompletionDotsFunc', async () => {
      expect(await cmd._genCompletionDotsFunc()).toBe(`expand-or-complete-with-dots() {
  echo -n "..."
  zle expand-or-complete
  zle redisplay
}
zle -N expand-or-complete-with-dots
bindkey "^I" expand-or-complete-with-dots`)
    })

    runtest('#_genShellSetups (0: bash)', async () => {
      let cmd = await new AutocompleteCacheBase()
      let shellSetups = await cmd._genShellSetups()
      expect(shellSetups[0]).toBe(`HEROKU_AC_ANALYTICS_DIR=${cmd.config.cacheDir}/completions/completion_analytics;
HEROKU_AC_COMMANDS_PATH=${cmd.config.cacheDir}/completions/commands;
HEROKU_BASH_AC_PATH=${AC_PLUGIN_PATH}/autocomplete/bash/heroku.bash test -f $HEROKU_BASH_AC_PATH && source $HEROKU_BASH_AC_PATH;
`)
    })

    runtest('#_genShellSetups (1: zsh)', async () => {
      let cmd = await new AutocompleteCacheBase()
      let shellSetups = await cmd._genShellSetups()
      expect(shellSetups[1]).toBe(`expand-or-complete-with-dots() {
  echo -n "..."
  zle expand-or-complete
  zle redisplay
}
zle -N expand-or-complete-with-dots
bindkey "^I" expand-or-complete-with-dots
HEROKU_AC_ANALYTICS_DIR=${cmd.config.cacheDir}/completions/completion_analytics;
HEROKU_AC_COMMANDS_PATH=${cmd.config.cacheDir}/completions/commands;
HEROKU_ZSH_AC_SETTERS_PATH=\${HEROKU_AC_COMMANDS_PATH}_functions && test -f $HEROKU_ZSH_AC_SETTERS_PATH && source $HEROKU_ZSH_AC_SETTERS_PATH;
fpath=(
${AC_PLUGIN_PATH}/autocomplete/zsh
$fpath
);
autoload -Uz compinit;
compinit;
`)
    })

    runtest('#_genShellSetups (1: zsh w/o ellipsis)', async () => {
      let cmd = await new AutocompleteCacheBase()
      let shellSetups = await cmd._genShellSetups(true)
      expect(shellSetups[1]).toBe(`
HEROKU_AC_ANALYTICS_DIR=${cmd.config.cacheDir}/completions/completion_analytics;
HEROKU_AC_COMMANDS_PATH=${cmd.config.cacheDir}/completions/commands;
HEROKU_ZSH_AC_SETTERS_PATH=\${HEROKU_AC_COMMANDS_PATH}_functions && test -f $HEROKU_ZSH_AC_SETTERS_PATH && source $HEROKU_ZSH_AC_SETTERS_PATH;
fpath=(
${AC_PLUGIN_PATH}/autocomplete/zsh
$fpath
);
autoload -Uz compinit;
compinit;
`)
    })

    runtest('#_genZshAllCmdsListSetter', async () => {
      let cmdsWithDesc = [`"foo\\:alpha":"foo:alpha description"`, `"foo\\:beta":"foo:beta description"`]
      expect(await cmd._genZshAllCmdsListSetter(cmdsWithDesc)).toBe(`
_set_all_commands_list () {
_all_commands_list=(
"foo\\:alpha":"foo:alpha description"
"foo\\:beta":"foo:beta description"
)
}
`)
    })

    runtest('#_genZshCmdFlagsSetter', async () => {
      expect(await cmd._genZshCmdFlagsSetter(AutocompleteCache)).toBe(`_set_autocomplete_cache_flags () {
_flags=(
"--skip-ellipsis[(switch) Do not add an ellipsis to zsh autocomplete setup]"
"--visable[(switch) Visable flag]"
)
}
`)
    })
  })
})
