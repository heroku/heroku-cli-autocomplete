import {flags} from '@heroku-cli/command'
import {AppCompletion, PipelineCompletion, SpaceCompletion, TeamCompletion} from '@heroku-cli/command/lib/completions'
import {IConfig} from '@oclif/config'
import chalk from 'chalk'
import {cli} from 'cli-ux'

import {AutocompleteBase} from '../../base'

import Create from './create'

export default class Index extends AutocompleteBase {
  static description = 'display autocomplete installation instructions'

  static args = [{name: 'shell', description: 'shell type', required: false}]

  static flags = {
    'skip-instructions': flags.boolean({description: 'don\'t show installation instructions', char: 's'}),
  }

  static examples = [
    '$ heroku autocomplete',
    '$ heroku autocomplete bash',
    '$ heroku autocomplete zsh'
  ]

  async run() {
    this.errorIfWindows()

    const {args, flags} = this.parse(Index)
    const shell = args.shell || this.config.shell

    if (!shell) {
      this.error('Error: Missing required argument shell')
    }

    this.errorIfNotSupportedShell(shell)

    cli.action.start(`${chalk.bold('Building the autocomplete cache')}`)
    await Create.run([], this.config)
    await AppCompletion.options({config: this.config})
    cli.action.stop()

    if (!flags['skip-instructions']) {
      const bin = this.config.bin
      const bashNote = 'If your terminal starts as a login shell you may need to print the init script into ~/.bash_profile or ~/.profile.'
      const zshNote = `After sourcing, you can run \`${chalk.cyan('$ compaudit -D')}\` to ensure no permissions conflicts are present`
      const note = shell === 'zsh' ? zshNote : bashNote
      const tabStr = shell === 'bash' ? '<TAB><TAB>' : '<TAB>'

      this.log(`
${chalk.bold(`Setup Instructions for ${bin.toUpperCase()} CLI Autocomplete ---`)}

1) Add the autocomplete env var to your ${shell} profile and source it
${chalk.cyan(`$ printf "$(${bin} autocomplete:script ${shell})" >> ~/.${shell}rc; source ~/.${shell}rc`)}

NOTE: ${note}

2) Test it out, e.g.:
${chalk.cyan(`$ ${bin} ${tabStr}`)}                 # Command completion
${chalk.cyan(`$ ${bin} apps:info --${tabStr}`)}     # Flag completion
${chalk.cyan(`$ ${bin} apps:info --app=${tabStr}`)} # Flag option completion

Visit the autocomplete Dev Center doc at https://devcenter.heroku.com/articles/heroku-cli-autocomplete

Enjoy!
`)
    }
  }
}
