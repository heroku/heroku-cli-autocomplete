// @flow

import Command from 'cli-engine-command'
import cli from 'cli-ux'
import moment from 'moment'
import path from 'path'

export class AutocompleteBase extends Command<*> {
  errorIfWindows() {
    if (this.config.windows) {
      this.out.error('Autocomplete is not currently supported in Windows')
    }
  }

  get completionsCachePath(): string {
    return path.join(this.config.cacheDir, 'completions')
  }

  get acLogfile(): string {
    return path.join(this.config.cacheDir, 'autocomplete.log')
  }

  writeLogFile(msg: string) {
    cli.stdout.constructor.logToFile(`[${moment().format()}] ${msg}\n`, this.acLogfile)
  }
}
