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
    // A gather input
    // B get needed data
    //  1. get cmd to hydrate
    //  2. set argv
    // C determine want
    //  see below...
    // D determine context
    //  1. args remaining & complete-able?
    //  2. flags remaining & complete-able?
    // E from want & context, return wanted

    // WANT --
    // WE ONLY RETURN ARG/FLAG VALUE COMPELETIONS
    // (not short/long flag char/name)
    // so the "want" can only be:
    //  1. the current arg value completion
    //  2. the current flag value completion
    //  (& it may be asking in error, ex: for flag name or nothing left to compelete)

    //
    // First question is, what is the curArg?

    // all curArg types:
    // 1) undefined (ERROR)
    // 2) ''
    // 3) myar <- semi-completed arg value
    // 4) myfl <- semi-completed flag value
    // 5) --foo=myfl <- semi-completed long= flag value
    // 6) -* || --f* <- semi-completed flag name (ERROR)

    // 1) if curArg undefined, beep/exit

    // 2) if curArg is ''
    // can only be:
    // a. cur = nth arg completion
    // b. cur = cur-1 flag value completion
    // c. cur = beep/end-of-available-completions

    // 3/4/5/6) if curArg is a not ''
    // we are in the middle of a completion
    // 6) if curArg is semi-completed flag name, beep/exit

    try {
      // A
      const cliArgv = this.argv[0].split(' ')
      const argv = cliArgv.slice(2)

      // B
      const curArg = argv[argv.length - 1]
      const previousArg = argv[argv.length - 2]
      const cmdId = cliArgv[1]
      const plugins = new Plugins(this.out)
      await plugins.load()
      let Command = await plugins.findCommand(cmdId)
      if (!Command) throw new Error(`1`)

      // C
      let cacheKey = 'void'
      let cacheCompletion : ?Object
      let [argvArgCount, curIsFlag, curIsFlagValue] = this._calcCurArgvState(argv, Command)

      if (curIsFlag || curIsFlagValue) {
        const argvFlag = curIsFlagValue ? previousArg : curArg
        let {name, flag} = this._findFlagFromWildArg(argvFlag, Command)
        if (!flag) throw new Error(`6`)
        cacheKey = flag.name || name || 'no_name'
        cacheCompletion = flag.completion
      } else {
        const cmdArgs = Command.args || []
        const cmdArgsCount = cmdArgs.length
        if (argvArgCount > cmdArgsCount || argvArgCount === 0) throw new Error(`2c`)
        const arg = cmdArgs[argvArgCount - 1]
        cacheKey = arg.name
        cacheCompletion = arg.completion
      }

      // D
      // load context from flags= and completed args

      // E
      if (cacheCompletion && cacheCompletion.options) {
        const args = this.parsedArgs
        const flags = this.parsedFlags
        const ctx = {args, flags, argv: this.argv, out: this.out}
        const ckey = cacheCompletion.cacheKey ? await cacheCompletion.cacheKey(ctx) : null
        const key = (ckey || cacheKey)
        const flagCache = path.join(this.completionsPath, key)
        const duration = cacheCompletion.cacheDuration || 60 * 60 * 24 // 1 day
        const cacheFunc = cacheCompletion.options(ctx)
        const opts = {cacheFn: () => cacheFunc}
        const options = await ACCache.fetch(flagCache, duration, opts)
        this.out.log((options || []).join('\n'))
      }
    } catch (err) {
      // this.out.log(err)
      process.stderr.write('\x07')
    }
  }

  _findFlagFromWildArg (wild: string, Command: Class<Command<*>>) {
    let name = wild.replace(/^-+/, '')

    let flag = Command.flags[name]
    if (flag) return {name, flag}

    name = Object.keys(Command.flags).find(k => Command.flags[k].char === name)
    flag = Command.flags[name]
    if (flag) return {name, flag}
    return {}
  }

  _calcCurArgvState (argv: Array<string>, Command: Class<Command<*>>): [number, boolean, boolean] {
    let needFlagValueSatisfied = false
    let argIsFlag = false
    let argIsFlagValue = false
    let argsIndex = 0
    let flagName
    // find number of argv's (including '')
    // that are not a flag or flag value
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
    // unit test this
    // "ac:foo " 1, false, false
    // "ac:foo arg" 1, false, false

    // "ac:foo arg " 2, false, false
    // "ac:foo arg barg" 2, false, false

    // "ac:foo arg barg " 3, false, false

    // (ERROR, but not here, cause this is flag name completion)
    // "ac:foo arg -f" 1, true, false
    // "ac:foo arg --f" 1, true, false
    // "ac:foo arg --foo" 1, true, false

    // "ac:foo arg -s " 1, false, true
    // "ac:foo arg --space " 1, false, true

    // "ac:foo arg --foo " 2, false, false
    // "ac:foo arg -f " 2, false, false

    // ??? does this matter yet?
    // "ac:foo arg --space=" 1, true, false <<???
  }
}
