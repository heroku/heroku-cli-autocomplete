// @flow

import { Config } from '@cli-engine/engine/lib/config'
import { Plugins } from '@cli-engine/engine/lib/plugins'
import { Plugin } from '@cli-engine/engine/lib/plugins/plugin'
import Command, { flags } from '@heroku-cli/command'
import * as Completions from '@heroku-cli/command/lib/completions'
import StreamOutput from 'cli-ux/lib/stream'
import * as moment from 'moment'
import * as path from 'path'

const ComplationMapping: { [key: string]: flags.ICompletion } = {
  app: Completions.AppCompletion,
  addon: Completions.AppAddonCompletion,
  dyno: Completions.AppDynoCompletion,
  buildpack: Completions.BuildpackCompletion,
  // dynosize: Completions.AppCompletion,
  // file: Completions.FileCompletion,
  pipeline: Completions.PipelineCompletion,
  // processtype: Completions.ProcessTypeCompletion,
  region: Completions.RegionCompletion,
  role: Completions.RoleCompletion,
  scope: Completions.ScopeCompletion,
  space: Completions.SpaceCompletion,
  stack: Completions.StackCompletion,
  stage: Completions.StageCompletion,
  Team: Completions.TeamCompletion,
}

const CompletionBlacklist: { [key: string]: string[] } = {
  app: ['apps:create'],
}

export abstract class AutocompleteBase extends Command {
  public errorIfWindows() {
    if (this.config.windows) {
      throw new Error('Autocomplete is not currently supported in Windows')
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

  protected async plugins(): Promise<Plugin[]> {
    const config = new Config(this.config)
    return await new Plugins(config).list()
  }

  protected findCompletion(name: string, id: string): flags.ICompletion | undefined {
    if (this.blacklisted(name, id)) return
    if (ComplationMapping[name]) return ComplationMapping[name]
  }

  private blacklisted(name: string, id: string): boolean {
    return CompletionBlacklist[name] && CompletionBlacklist[name].includes(id)
  }
}
