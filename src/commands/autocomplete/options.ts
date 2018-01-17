// @flow

import { ICommand } from '@cli-engine/config'
import { CommandManager } from '@cli-engine/engine/lib/command'
import { Config } from '@cli-engine/engine/lib/config'
import { Plugins } from '@cli-engine/engine/lib/plugins'
import { flags as Flags } from '@heroku-cli/command'
import { cli } from 'cli-ux'
import * as path from 'path'

import { AutocompleteBase, ConfigCompletion } from '../../autocomplete'
import ACCache from '../../cache'

export default class AutocompleteOptions extends AutocompleteBase {
  static topic = 'autocomplete'
  static command = 'options'
  static description = 'dynamic completion'
  static variableArgs = true
  static hidden = true
  static flags = {
    app: Flags.app({ required: false, hidden: true }),
  }

  parsedArgs: { [name: string]: string } = {}
  parsedFlags: { [name: string]: string } = {}

  async run() {
    // ex: heroku autocomplete:options 'heroku addons:destroy -a myapp myaddon'
    try {
      // A - grab cmd line to complete from argv
      const commandLineToComplete = this.argv[0].split(' ')

      // B - find cmd to complete
      const cmdId = commandLineToComplete[1]
      const config = new Config(this.config)
      config.plugins = new Plugins(config)
      const CM = new CommandManager(config)
      const iCmd = await CM.findCommand(cmdId, true)
      const Command = await iCmd.fetchCommand()

      // C -
      // 1. find what arg/flag is asking to be completed
      // 2. set any parsable context from exisitng args/flags
      // 3. set vars needed to build/retrive options cache
      const slicedArgv = commandLineToComplete.slice(2)
      const slicedArgvCount = slicedArgv.length
      let [curPositionIsFlag, curPositionIsFlagValue] = this.determineCmdState(slicedArgv, Command)

      let cacheKey: any
      let cacheCompletion: any

      if (curPositionIsFlag || curPositionIsFlagValue) {
        const lastArgvArg = slicedArgv[slicedArgvCount - 1]
        const previousArgvArg = slicedArgv[slicedArgvCount - 2]
        const argvFlag = curPositionIsFlagValue ? previousArgvArg : lastArgvArg
        let { name, flag } = this.findFlagFromWildArg(argvFlag, Command)
        if (!flag) this.throwError(`${argvFlag} is not a valid flag for ${cmdId}`)
        cacheKey = name || flag.name
        cacheCompletion = flag.completion
      } else {
        // special config:* completions
        if (cmdId.match(/config:(\w+)et$/)) {
          if (this.flags.app) cacheCompletion = ConfigCompletion
          else this.throwError(`No app found for config completion (cmdId: ${cmdId})`)
        } else {
          const cmdArgs = Command.args || []
          const cmdArgsCount = cmdArgs.length
          if (slicedArgvCount > cmdArgsCount || slicedArgvCount === 0)
            this.throwError(`Cannot complete arg position ${slicedArgvCount} for ${cmdId}`)
          const arg = cmdArgs[slicedArgvCount - 1]
          cacheKey = arg.name
        }
      }

      // try to auto-populate the completion object
      if (!cacheCompletion) {
        cacheCompletion = this.findCompletion(cacheKey, cmdId)
      }
      // build/retrieve & return options cache
      if (cacheCompletion && cacheCompletion.options) {
        // use cacheKey function or fallback to arg/flag name
        const ctx = {
          args: this.parsedArgs,
          flags: this.parsedFlags,
          argv: this.argv,
          config: this.config,
          app: this.flags.app, // special case for config completion
        }
        const ckey = cacheCompletion.cacheKey ? await cacheCompletion.cacheKey(ctx) : null
        const key: string = ckey || cacheKey || 'unknown_key_error'
        const flagCachePath = path.join(this.completionsCachePath, key)

        // build/retrieve cache
        const duration = cacheCompletion.cacheDuration || 60 * 60 * 24 // 1 day
        const opts = { cacheFn: () => cacheCompletion.options(ctx) }
        const options = await ACCache.fetch(flagCachePath, duration, opts)

        // return options cache
        cli.log((options || []).join('\n'))
      }
    } catch (err) {
      // write to ac log
      this.writeLogFile(err.message)
    }
  }

  private throwError(msg: string) {
    throw new Error(msg)
  }

  // TO-DO: create a return type
  private findFlagFromWildArg(wild: string, Command: ICommand): { flag: any; name: any } {
    let name = wild.replace(/^-+/, '')
    name = name.replace(/=(.+)?$/, '')

    let unknown = { flag: undefined, name: undefined }
    if (!Command.flags) return unknown
    const CFlags = Command.flags

    let flag = CFlags[name]
    if (flag) return { name, flag }

    name = Object.keys(CFlags).find((k: string) => CFlags[k].char === name) || 'undefinedcommand'
    flag = CFlags && CFlags[name]
    if (flag) return { name, flag }
    return unknown
  }

  private determineCmdState(argv: Array<string>, Command: ICommand): [boolean, boolean] {
    let needFlagValueSatisfied = false
    let argIsFlag = false
    let argIsFlagValue = false
    let argsIndex = 0
    let flagName: string

    argv.filter(wild => {
      if (wild.match(/^-(-)?/)) {
        // we're a flag
        argIsFlag = true

        // ignore me
        const wildSplit = wild.split('=')
        const key = wildSplit.length === 1 ? wild : wildSplit[0]
        const { name, flag } = this.findFlagFromWildArg(key, Command)
        flagName = name
        // end ignore me

        if (wildSplit.length === 1) {
          // we're a flag w/o a '=value'
          // (find flag & see if flag needs a value)
          if (flag && flag.parse) {
            // we're a flag who needs our value to be next
            argIsFlagValue = false
            needFlagValueSatisfied = true
            return false
          }
        }

        // --app=my-app is consided a flag & not a flag value
        // the shell's autocomplete handles partial value matching

        // add parsedFlag
        if (wildSplit.length === 2 && name) this.parsedFlags[name] = wildSplit[1]

        // we're a flag who is satisfied
        argIsFlagValue = false
        needFlagValueSatisfied = false
        return false
      }

      // we're not a flag
      argIsFlag = false

      if (needFlagValueSatisfied) {
        // we're a flag value

        // add parsedFlag
        if (flagName) this.parsedFlags[flagName] = wild

        argIsFlagValue = true
        needFlagValueSatisfied = false
        return false
      }

      // we're an arg!

      // add parsedArgs
      // TO-DO: how to handle variableArgs?
      if (argsIndex < (Command.args || []).length) {
        let CArgs = Command.args || []
        this.parsedArgs[CArgs[argsIndex].name] = wild
        argsIndex += 1
      }

      argIsFlagValue = false
      needFlagValueSatisfied = false
      return true
    })

    return [argIsFlag, argIsFlagValue]
  }
}
