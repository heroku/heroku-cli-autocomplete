import {Command} from '@oclif/config'
import * as fs from 'fs-extra'
import * as path from 'path'

import {AutocompleteBase} from '../../base'

const debug = require('debug')('cli-autocomplete:buildcache')

interface CacheStrings {
  cmdsWithFlags: string
  cmdFlagsSetters: string
  cmdsWithDescSetter: string
}

export default class Buildcache extends AutocompleteBase {
  static hidden = true
  static description = 'build autocomplete cache'

  async run() {
    this.errorIfWindows()
    await this.createCaches()
  }

  async createCaches() {
    // if (this.config.mock) return
    // 1. ensure completions cache dir
    await fs.ensureDir(this.autocompleteCachePath)
    await fs.ensureDir(this.completionsCachePath)
    // 2. create commands cache strings
    const cacheStrings = await this.genCmdsCacheStrings()
    // 3. save bash commands with flags list
    await fs.writeFile(path.join(this.autocompleteCachePath, 'commands'), cacheStrings.cmdsWithFlags)
    // 4. save zsh command with descriptions list & command-flags setters
    const zshFuncs = `${cacheStrings.cmdsWithDescSetter}\n${cacheStrings.cmdFlagsSetters}`
    await fs.writeFile(path.join(this.autocompleteCachePath, 'commands_setters'), zshFuncs)
    // 5. save shell setups
    const [bashSetup, zshSetup] = this.genShellSetups(this.skipEllipsis)
    await fs.writeFile(path.join(this.autocompleteCachePath, 'bash_setup'), bashSetup)
    await fs.writeFile(path.join(this.autocompleteCachePath, 'zsh_setup'), zshSetup)
  }

  get skipEllipsis(): boolean {
    return process.env.HEROKU_AC_ZSH_SKIP_ELLIPSIS === '1'
  }

  private async genCmdsCacheStrings(): Promise<CacheStrings> {
    // bash
    let cmdsWithFlags: string[] = []
    // zsh
    let cmdFlagsSetters: string[] = []
    let cmdsWithDesc: string[] = []
    const plugins = this.config.plugins
    plugins.map(p => {
      p.commands.map(c => {
        try {
          if (c.hidden) return
          // console.log(c)
          const id = this.genCmdID(c)
          const publicFlags = this.genCmdPublicFlags(c)
          cmdsWithFlags.push(`${id} ${publicFlags}`.trim())
          cmdFlagsSetters.push(this.genZshCmdFlagsSetter(c))
          cmdsWithDesc.push(this.genCmdWithDescription(c))
        } catch (err) {
          debug(`Error creating autocomplete for command in ${this.genCmdID(c)}, moving on...`)
          debug(err.message)
          this.writeLogFile(err.message)
        }
      })
    })

    return {
      cmdsWithFlags: cmdsWithFlags.join('\n'),
      cmdFlagsSetters: cmdFlagsSetters.join('\n'),
      cmdsWithDescSetter: this.genZshAllCmdsListSetter(cmdsWithDesc),
    }
  }

  private genCmdID(Command: Command): string {
    return Command.id || 'commandIdUndefined'
  }

  private genCmdPublicFlags(Command: Command): string {
    let Flags = Command.flags || {}
    return Object.keys(Flags)
      .filter(flag => !Flags[flag].hidden)
      .map(flag => `--${flag}`)
      .join(' ')
  }

  private genCmdWithDescription(Command: Command): string {
    let description = ''
    if (Command.description) {
      let text = Command.description.split('\n')[0]
      description = `:"${text}"`
    }
    return `"${this.genCmdID(Command).replace(/:/g, '\\:')}"${description}`
  }

  private genZshCmdFlagsSetter(Command: Command): string {
    const id = this.genCmdID(Command)
    const flagscompletions = Object.keys(Command.flags || {})
      .filter(flag => Command.flags && !Command.flags[flag].hidden)
      .map(flag => {
        const f = (Command.flags && Command.flags[flag]) || {description: ''}
        const isBoolean = f.type === 'boolean'
        const hasCompletion = f.hasOwnProperty('completion') || this.findCompletion(flag, id)
        const name = isBoolean ? flag : `${flag}=-`
        let cachecompl = ''
        if (hasCompletion) {
          cachecompl = ': :_compadd_flag_options'
        }
        const help = isBoolean ? '(switch) ' : (hasCompletion ? '(autocomplete) ' : '')
        const completion = `--${name}[${help}${f.description}]${cachecompl}`
        return `"${completion}"`
      })
      .join('\n')

    if (flagscompletions) {
      return `_set_${id.replace(/:/g, '_')}_flags () {
_flags=(
${flagscompletions}
)
}
`
    }
    return `# no flags for ${id}`
  }

  private genZshAllCmdsListSetter(cmdsWithDesc: Array<string>): string {
    return `
_set_all_commands_list () {
_all_commands_list=(
${cmdsWithDesc.join('\n')}
)
}
`
  }

  private genShellSetups(skipEllipsis: boolean = false): Array<string> {
    const envAnalyticsDir = `HEROKU_AC_ANALYTICS_DIR=${path.join(
      this.autocompleteCachePath,
      'completion_analytics',
    )};`
    const envCommandsPath = `HEROKU_AC_COMMANDS_PATH=${path.join(this.autocompleteCachePath, 'commands')};`
    const zshSetup = `${skipEllipsis ? '' : this.genCompletionDotsFunc()}
${envAnalyticsDir}
${envCommandsPath}
HEROKU_AC_ZSH_SETTERS_PATH=\${HEROKU_AC_COMMANDS_PATH}_setters && test -f $HEROKU_AC_ZSH_SETTERS_PATH && source $HEROKU_AC_ZSH_SETTERS_PATH;
fpath=(
${path.join(__dirname, '..', '..', '..', 'autocomplete', 'zsh')}
$fpath
);
autoload -Uz compinit;
compinit;
`
    const bashSetup = `${envAnalyticsDir}
${envCommandsPath}
HEROKU_AC_BASH_COMPFUNC_PATH=${path.join(
      __dirname,
      '..',
      '..',
      '..',
      'autocomplete',
      'bash',
      'cli_engine.bash',
    )} && test -f $HEROKU_AC_BASH_COMPFUNC_PATH && source $HEROKU_AC_BASH_COMPFUNC_PATH;
`
    return [bashSetup, zshSetup]
  }

  private genCompletionDotsFunc(): string {
    return `expand-or-complete-with-dots() {
  echo -n "..."
  zle expand-or-complete
  zle redisplay
}
zle -N expand-or-complete-with-dots
bindkey "^I" expand-or-complete-with-dots`
  }
}
