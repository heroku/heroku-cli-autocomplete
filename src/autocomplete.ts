// @flow

import Command from '@heroku-cli/command'
import { cli } from 'cli-ux'
import StreamOutput from 'cli-ux/lib/stream'
import * as moment from 'moment'
import * as path from 'path'

export abstract class AutocompleteBase extends Command {
  public errorIfWindows() {
    if (this.config.windows) {
      cli.error('Autocomplete is not currently supported in Windows')
    }
  }

  public get completionsCachePath(): string {
    return path.join(this.config.cacheDir, 'completions')
  }

  public get acLogfile(): string {
    return path.join(this.config.cacheDir, 'autocomplete.log')
  }

  writeLogFile(msg: string) {
    StreamOutput.logToFile(`[${moment().format()}] ${msg}\n`, this.acLogfile)
  }
}
