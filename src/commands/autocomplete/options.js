// @flow

import type Command from 'cli-engine-command'
import Plugins from 'cli-engine/lib/plugins'
import path from 'path'
import ACCache from '../../cache'
import AutocompleteBase from '.'

export default class ACFoo extends AutocompleteBase {
  static topic = 'autocomplete'
  static command = 'options'
  static description = 'dynamic completion'
  static variableArgs = true
  static hidden = true

  beep: string = '\x07'
  parsedArgs: {[name: string]: ?string} = {}
  parsedFlags: {[name: string]: ?string} = {}

  async run () {
    // ex: heroku autocomplete:options 'heroku addons:destroy -a myapp myaddon'
    try {
      // A - grab cmd line to complete from argv
      const commandLineToComplete = this.argv[0].split(' ')

      // B - find cmd to complete
      const cmdId = commandLineToComplete[1]
      const plugins = new Plugins(this.out)
      await plugins.load()
      let Command = await plugins.findCommand(cmdId)
      if (!Command) throw new Error(`Command ${cmdId} not found`)

      // C -
      // 1. find what arg/flag is asking to be completed
      // 2. set any parsable context from exisitng args/flags
      // 3. set vars needed to build/retrive options cache
      const cmdArgv = commandLineToComplete.slice(2)
      const cmdArgvCount = cmdArgv.length
      const cmdCurArgv = cmdArgv[cmdArgvCount - 1]
      const cmdPreviousArgv = cmdArgv[cmdArgvCount - 2]
      let [cmdCurArgCount, cmdCurArgvIsFlag, cmdCurArgvIsFlagValue] = this._determineCmdState(cmdArgv, Command)
      let cacheKey
      let cacheCompletion

      if (cmdCurArgvIsFlag || cmdCurArgvIsFlagValue) {
        const argvFlag = cmdCurArgvIsFlag ? cmdPreviousArgv : cmdCurArgv
        let {name, flag} = this._findFlagFromWildArg(argvFlag, Command)
        if (!flag) throw new Error(`${argvFlag} is not a valid flag for ${cmdId}`)
        cacheKey = name || flag.name
        cacheCompletion = flag.completion
      } else {
        const cmdArgs = Command.args || []
        const cmdArgsCount = cmdArgs.length
        if (cmdCurArgCount > cmdArgsCount || cmdCurArgCount === 0) throw new Error(`Cannot complete arg position ${cmdCurArgCount} for ${cmdId}`)
        const arg = cmdArgs[cmdCurArgCount - 1]
        cacheKey = arg.name
        cacheCompletion = arg.completion
      }

      // build/retrieve & return options cache
      if (cacheCompletion && cacheCompletion.options) {
        // use cacheKey function or fallback to arg/flag name
        const ctx = {args: this.parsedArgs, flags: this.parsedFlags, argv: this.argv, out: this.out}
        const ckey = cacheCompletion.cacheKey ? await cacheCompletion.cacheKey(ctx) : null
        const key = (ckey || cacheKey)
        const flagCachePath = path.join(this.completionsPath, key)

        // build/retrieve cache
        const duration = cacheCompletion.cacheDuration || 60 * 60 * 24 // 1 day
        const cacheFunc = cacheCompletion.options(ctx)
        const opts = {cacheFn: () => cacheFunc}
        const options = await ACCache.fetch(flagCachePath, duration, opts)

        // return options cache
        this.out.log((options || []).join('\n'))
      }
    } catch (err) {
      // on error make audible 'beep'
      process.stderr.write('\x07')
      // write to ac log
      this.writeLogFile(err.message)
    }
  }

  _findFlagFromWildArg (wild: string, Command: Class<Command<*>>) {
    let name = wild.replace(/^-+/, '')
    name = name.replace(/=(\w+)?$/, '')

    let flag = Command.flags[name]
    if (flag) return {name, flag}

    name = Object.keys(Command.flags).find(k => Command.flags[k].char === name)
    flag = Command.flags[name]
    if (flag) return {name, flag}
    return {}
  }

  _determineCmdState (argv: Array<string>, Command: Class<Command<*>>): [number, boolean, boolean] {
    let needFlagValueSatisfied = false
    let argIsFlag = false
    let argIsFlagValue = false
    let argsIndex = 0
    let flagName
    // find cur index of argv (including empty '')
    // that are not flags or flag values
    const nthArg = argv.filter(wild => {
      if (wild.match(/^-(-)?/)) {
        // we're a flag
        argIsFlag = true

        // ignore me
        const wildSplit = wild.split('=')
        const key = wildSplit.length === 1 ? wild : wildSplit[0]
        const {name, flag} = this._findFlagFromWildArg(key, Command)
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
      if (argsIndex < Command.args.length) {
        this.parsedArgs[Command.args[argsIndex].name] = wild
        argsIndex += 1
      }

      argIsFlagValue = false
      needFlagValueSatisfied = false
      return true
    }).length

    return [nthArg, argIsFlag, argIsFlagValue]
  }
}
