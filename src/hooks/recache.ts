import {AppCompletion, PipelineCompletion, SpaceCompletion, TeamCompletion} from '@heroku-cli/command/lib/completions'
import {Hook, IConfig} from '@oclif/config'
import cli from 'cli-ux'
import * as fs from 'fs-extra'
import * as path from 'path'

import acCreate from '../commands/autocomplete/create'

export const completions: Hook<any> = async function ({type}: {type?: 'app' | 'addon'}) {
  const lazy = type === 'app' || type === 'addon'
  const rm = () => fs.emptyDir(path.join(this.config.cacheDir, 'autocomplete', 'completions'))
  if (lazy) return rm()
  cli.action.start('Updating completions')
  await rm()
  const config: IConfig = this.config
  await acCreate.run([], config)
  await AppCompletion.options({config})
  await PipelineCompletion.options({config})
  await SpaceCompletion.options({config})
  await TeamCompletion.options({config})
  cli.done()
}
