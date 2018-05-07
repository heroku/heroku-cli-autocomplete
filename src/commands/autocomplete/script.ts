import * as path from 'path'

import {AutocompleteBase} from '../../base'

export default class Script extends AutocompleteBase {
  static description = 'outputs autocomplete config script for shells'
  static hidden = true
  static args = [{name: 'shell', description: 'shell type', required: false}]

  async run() {
    this.errorIfWindows()
    const {args} = this.parse(Script)

    const shell = args.shell || this.config.shell
    if (!shell) {
      this.error('Error: Missing required argument shell')
    }

    if (shell === 'bash' || shell === 'zsh') {
      let shellUpcase = shell.toUpperCase()
      this.log(
        `${this.prefix}HEROKU_AC_${shellUpcase}_SETUP_PATH=${path.join(
          this.autocompleteCachePath,
          `${shell}_setup`,
        )} && test -f $HEROKU_AC_${shellUpcase}_SETUP_PATH && source $HEROKU_AC_${shellUpcase}_SETUP_PATH;`,
      )
    } else {
      this.error(`No autocomplete script for ${shell}. Run $ ${this.config.bin} autocomplete for install instructions.`)
    }
  }

  private get prefix(): string {
    return `\n# ${this.config.bin} autocomplete setup\n`
  }
}
