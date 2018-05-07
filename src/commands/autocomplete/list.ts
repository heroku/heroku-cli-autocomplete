import {AutocompleteBase} from '../../base'

export default class List extends AutocompleteBase {
  static hidden = true
  static description = 'debugger for autocomplete'

  async run() {
    this.errorIfWindows()

    const plugins = this.config.plugins
    plugins.map(p => {
      p.commands.map(c => {
        try {
          if (c.hidden) {
            this.log(`${c.id} (hidden)`)
          } else {
            let results = Object.keys(c.flags).map((f: string) => {
              let flag: any = c.flags[f]
              if (flag.hidden) return `--${f} (hidden)`
              else if (flag.completion) {
                return `--${f} (completion)`
              } else return `--${f}`
            })
            if (results.length) this.log(`${c.id} -> ${results}`)
          }
        } catch {
          this.log(`Error creating autocomplete for command ${c.id}`)
        }
      })
    })
  }
}
