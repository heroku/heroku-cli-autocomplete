// @flow

import type Output from 'cli-engine-command/lib/output'
import {Command, flags, APIClient as Heroku} from 'cli-engine-heroku'

const addonCompletion = {
  // cacheDuration defaults to 1 day
  cacheDuration: 60 * 60, // 1 hour
  // cacheKey defaults to arg or flag name
  cacheKey: `all_app_addons`,
  options: async (out: Output) => {
    const heroku = new Heroku({out: out})
    let addons = await heroku.get('/addons')
    return addons.map(a => a.name).sort()
  }
}

const appCompletion = {
  options: async (out: Output) => {
    const heroku = new Heroku({out: out})
    let apps = await heroku.get('/apps')
    return apps.map(a => a.name).sort()
  }
}

const spaceCompletion = {
  options: async (out: Output) => {
    const heroku = new Heroku({out: out})
    let spaces = await heroku.get('/spaces')
    return spaces.map(s => s.name).sort()
  }
}

export default class ACFoo extends Command {
  static topic = 'ac'
  static command = 'foo'
  static description = 'example command for arg & flag completions'
  static help = '$ heroku ac:foo myapp myaddon --space=myspace --json'
  static hidden = false
  static flags = {
    space: flags.string({description: 'space to use', char: 's', completion: spaceCompletion}),
    json: flags.boolean({description: 'view as json', char: 'j'})
  }
  static args = [
    {name: 'app', required: true, completion: appCompletion},
    {name: 'addon', optional: true, completion: addonCompletion}
  ]

  async run () {
    this.out.log(this.args)
    this.out.log(this.flags)
  }
}
