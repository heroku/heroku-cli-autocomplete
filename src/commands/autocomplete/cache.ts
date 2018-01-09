// @flow

// import Command from '@cli-engine/engine'
import { ICommand } from '@cli-engine/config'
import { Config } from '@cli-engine/engine/lib/config'
import { cli } from 'cli-ux'
import * as fs from 'fs-extra'
import * as path from 'path'

import { AutocompleteBase } from '../../autocomplete'
import { PluginLegacy } from '../../legacy'

const debug = require('debug')('cli-autocomplete:buildcache')

interface CacheStrings {
  cmdsWithFlags: string
  cmdFlagsSetters: string
  cmdsWithDescSetter: string
}

export default class AutocompleteCacheBuilder extends AutocompleteBase {
  static topic = 'autocomplete'
  static command = 'buildcache'
  static description = 'autocomplete cache builder'
  // hide until public release
  static hidden = true
  static aliases = ['autocomplete:init']

  plugins: { topics: any; commands: any }[] = []

  async run() {
    await this.createCaches()
  }

  async createCaches() {
    if (cli.config.mock) return
    await this.hydratePlugins()
    // 1. ensure completions cache dir
    await fs.ensureDir(this.completionsCachePath)
    // 2. create commands cache strings
    const cacheStrings = await this._genCmdsCacheStrings()
    // 3. save bash commands with flags list
    await fs.writeFile(path.join(this.completionsCachePath, 'commands'), cacheStrings.cmdsWithFlags)
    // 4. save zsh command with descriptions list & command-flags setters
    const zshFuncs = `${cacheStrings.cmdsWithDescSetter}\n${cacheStrings.cmdFlagsSetters}`
    await fs.writeFile(path.join(this.completionsCachePath, 'commands_functions'), zshFuncs)
    // 5. save shell setups
    const [bashSetup, zshSetup] = this._genShellSetups(this.skipEllipsis)
    await fs.writeFile(path.join(this.completionsCachePath, 'bash_setup'), bashSetup)
    await fs.writeFile(path.join(this.completionsCachePath, 'zsh_setup'), zshSetup)
  }

  get skipEllipsis(): boolean {
    return process.env.CLI_ENGINE_AC_ZSH_SKIP_ELLIPSIS === '1'
  }

  async hydratePlugins() {
    const config = new Config(this.config)
    const plugins = await config.plugins.list()
    this.plugins = await Promise.all(
      plugins.map(async (p: any) => {
        const hydrated = await p.pluginPath.require()
        return hydrated
      }),
    )
  }

  async _genCmdsCacheStrings(): Promise<CacheStrings> {
    // bash
    let cmdsWithFlags: string[] = []
    // zsh
    let cmdFlagsSetters: string[] = []
    let cmdsWithDesc: string[] = []
    const Legacy = new PluginLegacy(this.config)
    await Promise.all(
      this.plugins.map(async p => {
        let plgs = p.commands || []
        return plgs.map((c: any) => {
          try {
            if (c.hidden || !c.topic) return
            const Command = typeof c === 'function' ? c : Legacy.convertFromV5(c)
            const id = this._genCmdID(Command)
            const publicFlags = this._genCmdPublicFlags(Command)
            cmdsWithFlags.push(`${id} ${publicFlags}`.trim())
            cmdFlagsSetters.push(this._genZshCmdFlagsSetter(Command))
            cmdsWithDesc.push(this._genCmdWithDescription(Command))
          } catch (err) {
            debug(`Error creating autocomplete for command in ${this._genCmdID(c)}, moving on...`)
            debug(err.message)
            this.writeLogFile(err.message)
          }
        })
      }),
    )
    return {
      cmdsWithFlags: cmdsWithFlags.join('\n'),
      cmdFlagsSetters: cmdFlagsSetters.join('\n'),
      cmdsWithDescSetter: this._genZshAllCmdsListSetter(cmdsWithDesc),
    }
  }

  _genCmdID(Command: ICommand): string {
    if (Command.id) return Command.id
    let id = Command.command ? `${Command.topic}:${Command.command}` : Command.topic
    return id || 'undefinedcommand'
  }

  _genCmdPublicFlags(Command: ICommand): string {
    let Flags = Command.flags || {}
    return Object.keys(Flags)
      .filter(flag => !Flags[flag].hidden)
      .map(flag => `--${flag}`)
      .join(' ')
  }

  _genCmdWithDescription(Command: ICommand): string {
    const description = Command.description ? `:"${Command.description}"` : ''
    return `"${this._genCmdID(Command).replace(/:/g, '\\:')}"${description}`
  }

  _genZshCmdFlagsSetter(Command: ICommand): string {
    const id = this._genCmdID(Command)
    const flagscompletions = Object.keys(Command.flags || {})
      .filter(flag => Command.flags && !Command.flags[flag].hidden)
      .map(flag => {
        const f = (Command.flags && Command.flags[flag]) || { description: '' }
        const hasParse = f.hasOwnProperty('parse')
        const hasCompletion = f.hasOwnProperty('completion')
        const name = hasParse ? `${flag}=-` : flag
        let cachecompl = ''
        if (hasCompletion) {
          cachecompl = `: :_compadd_flag_options`
        }
        const help = hasParse ? (hasCompletion ? '(autocomplete) ' : '') : '(switch) '
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

  _genZshAllCmdsListSetter(cmdsWithDesc: Array<string>): string {
    return `
_set_all_commands_list () {
_all_commands_list=(
${cmdsWithDesc.join('\n')}
)
}
`
  }

  _genShellSetups(skipEllipsis: boolean = false): Array<string> {
    const envAnalyticsDir = `CLI_ENGINE_AC_ANALYTICS_DIR=${path.join(
      this.completionsCachePath,
      'completion_analytics',
    )};`
    const envCommandsPath = `CLI_ENGINE_AC_COMMANDS_PATH=${path.join(this.completionsCachePath, 'commands')};`
    const zshSetup = `${skipEllipsis ? '' : this._genCompletionDotsFunc()}
${envAnalyticsDir}
${envCommandsPath}
CLI_ENGINE_AC_ZSH_SETTERS_PATH=\${CLI_ENGINE_AC_COMMANDS_PATH}_functions && test -f $CLI_ENGINE_AC_ZSH_SETTERS_PATH && source $CLI_ENGINE_AC_ZSH_SETTERS_PATH;
fpath=(
${path.join(__dirname, '..', '..', '..', 'autocomplete', 'zsh')}
$fpath
);
autoload -Uz compinit;
compinit;
`
    const bashSetup = `${envAnalyticsDir}
${envCommandsPath}
CLI_ENGINE_AC_BASH_COMPFUNC_PATH=${path.join(
      __dirname,
      '..',
      '..',
      '..',
      'autocomplete',
      'bash',
      'cli_engine.bash',
    )} && test -f $CLI_ENGINE_AC_BASH_COMPFUNC_PATH && source $CLI_ENGINE_AC_BASH_COMPFUNC_PATH;
`
    return [bashSetup, zshSetup]
  }

  _genCompletionDotsFunc(): string {
    return `expand-or-complete-with-dots() {
  echo -n "..."
  zle expand-or-complete
  zle redisplay
}
zle -N expand-or-complete-with-dots
bindkey "^I" expand-or-complete-with-dots`
  }
}
