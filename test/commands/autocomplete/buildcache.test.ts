import {flags} from '@heroku-cli/command'
import {Config, Plugin} from '@oclif/config'
import {loadJSON} from '@oclif/config/lib/util'
import {expect} from 'chai'
import * as path from 'path'

import Buildcache from '../../../src/commands/autocomplete/buildcache'

const root = path.resolve(__dirname, '../../../package.json')
const config = new Config({root})

// autocomplete will throw error on windows
const {default: runtest} = require('../../helpers/runtest')

const AC_PLUGIN_PATH = path.resolve(__dirname, '..', '..', '..')

class CacheBuildFlagsTest extends Buildcache {
  static flags = {
    app: flags.app(),
    visable: flags.boolean({description: 'Visable flag', char: 'v'}),
    hidden: flags.boolean({description: 'Hidden flag', char: 'h', hidden: true}),
  }
}

runtest('Buildcache', () => {
  // Unit test private methods for extra coverage
  describe('private methods', () => {
    let cmd: any
    let Klass: any
    let plugin: any
    before(async () => {
      await config.load()
      cmd = new Buildcache([], config)
      plugin = new Plugin({root})
      cmd.config.plugins = [plugin]
      await plugin.load()
      plugin.manifest = await loadJSON(path.resolve(__dirname, '../../.oclif.manifest.json'))
      plugin.commands = Object.entries(plugin.manifest.commands).map(([id, c]) => ({...c, load: () => plugin.findCommand(id, {must: true})}))
      Klass = plugin.commands[1]
    })

    it('#genCmdID', async () => {
      expect(cmd.genCmdID(Klass)).to.eq('autocomplete:foo')
    })

    it('#genCmdWithDescription', async () => {
      expect(await cmd.genCmdWithDescription(Klass)).to.eq(
        '"autocomplete\\:foo":"foo cmd for autocomplete testing"',
      )
    })

    it('#genCmdPublicFlags', async () => {
      expect(cmd.genCmdPublicFlags(CacheBuildFlagsTest)).to.eq('--app --visable')
      expect(cmd.genCmdPublicFlags(CacheBuildFlagsTest)).to.not.match(/--hidden/)
      expect(cmd.genCmdPublicFlags(Buildcache)).to.eq('')
    })

    it('#genCmdsCacheStrings (cmdsWithFlags)', async () => {
      const cacheStrings = await cmd.genCmdsCacheStrings()
      expect(cacheStrings.cmdsWithFlags).to.eq('autocomplete --skip-instructions\nautocomplete:foo --app --bar --json')
    })

    it('#genCmdsCacheStrings (cmdFlagsSetters)', async () => {
      const cacheStrings = await cmd.genCmdsCacheStrings()
      expect(cacheStrings.cmdFlagsSetters).to.eq(`_set_autocomplete_flags () {
_flags=(
"--skip-instructions[(switch) Do not show installation instructions]"
)
}

_set_autocomplete_foo_flags () {
_flags=(
"--app=-[(autocomplete) app to use]: :_compadd_flag_options"
"--bar=-[bar for testing]"
"--json[(switch) output in json format]"
)
}
`)
    })

    it('#genCmdsCacheStrings (cmdsWithDescSetter)', async () => {
      const cacheStrings = await cmd.genCmdsCacheStrings()
      expect(cacheStrings.cmdsWithDescSetter).to.eq(`
_set_all_commands_list () {
_all_commands_list=(
"autocomplete":"display autocomplete instructions"
"autocomplete\\:foo":"foo cmd for autocomplete testing"
)
}
`)
    })

    it('#genCompletionDotsFunc', async () => {
      expect(await cmd.genCompletionDotsFunc()).to.eq(`expand-or-complete-with-dots() {
  echo -n "..."
  zle expand-or-complete
  zle redisplay
}
zle -N expand-or-complete-with-dots
bindkey "^I" expand-or-complete-with-dots`)
    })

    it('#genShellSetups (0: bash)', async () => {
      let shellSetups = await cmd.genShellSetups()
      expect(shellSetups[0]).to.eq(`HEROKU_AC_ANALYTICS_DIR=${cmd.config.cacheDir}/autocomplete/completion_analytics;
HEROKU_AC_COMMANDS_PATH=${cmd.config.cacheDir}/autocomplete/commands;
HEROKU_AC_BASH_COMPFUNC_PATH=${AC_PLUGIN_PATH}/autocomplete/bash/cli_engine.bash && test -f $HEROKU_AC_BASH_COMPFUNC_PATH && source $HEROKU_AC_BASH_COMPFUNC_PATH;
`)
    })

    it('#genShellSetups (1: zsh)', async () => {
      let shellSetups = await cmd.genShellSetups()
      expect(shellSetups[1]).to.eq(`expand-or-complete-with-dots() {
  echo -n "..."
  zle expand-or-complete
  zle redisplay
}
zle -N expand-or-complete-with-dots
bindkey "^I" expand-or-complete-with-dots
HEROKU_AC_ANALYTICS_DIR=${cmd.config.cacheDir}/autocomplete/completion_analytics;
HEROKU_AC_COMMANDS_PATH=${cmd.config.cacheDir}/autocomplete/commands;
HEROKU_AC_ZSH_SETTERS_PATH=\${HEROKU_AC_COMMANDS_PATH}_setters && test -f $HEROKU_AC_ZSH_SETTERS_PATH && source $HEROKU_AC_ZSH_SETTERS_PATH;
fpath=(
${AC_PLUGIN_PATH}/autocomplete/zsh
$fpath
);
autoload -Uz compinit;
compinit;
`)
    })

    it('#genShellSetups (1: zsh w/o ellipsis)', async () => {
      let shellSetups = await cmd.genShellSetups(true)
      expect(shellSetups[1]).to.eq(`
HEROKU_AC_ANALYTICS_DIR=${cmd.config.cacheDir}/autocomplete/completion_analytics;
HEROKU_AC_COMMANDS_PATH=${cmd.config.cacheDir}/autocomplete/commands;
HEROKU_AC_ZSH_SETTERS_PATH=\${HEROKU_AC_COMMANDS_PATH}_setters && test -f $HEROKU_AC_ZSH_SETTERS_PATH && source $HEROKU_AC_ZSH_SETTERS_PATH;
fpath=(
${AC_PLUGIN_PATH}/autocomplete/zsh
$fpath
);
autoload -Uz compinit;
compinit;
`)
    })

    it('#genZshAllCmdsListSetter', async () => {
      let cmdsWithDesc = ['"foo\\:alpha":"foo:alpha description"', '"foo\\:beta":"foo:beta description"']
      expect(await cmd.genZshAllCmdsListSetter(cmdsWithDesc)).to.eq(`
_set_all_commands_list () {
_all_commands_list=(
"foo\\:alpha":"foo:alpha description"
"foo\\:beta":"foo:beta description"
)
}
`)
    })

    it('#genZshCmdFlagsSetter', async () => {
      expect(await cmd.genZshCmdFlagsSetter(CacheBuildFlagsTest)).to.eq(`_set_autocomplete_buildcache_flags () {
_flags=(
"--app=-[(autocomplete) app to run command against]: :_compadd_flag_options"
"--visable[(switch) Visable flag]"
)
}
`)
    })
  })
})
