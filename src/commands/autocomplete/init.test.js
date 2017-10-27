// @flow

import AutocompleteInit from './init'
import os from 'os'
import cli from 'cli-ux'

// autocomplete will throw error on windows
let skipWindows = (os.platform() === 'windows' || os.platform() === 'win32') ? xtest : test

skipWindows('--skip-ellipsis', async () => {
  cli.config.mock = true
  let cmd = await AutocompleteInit.mock('--skip-ellipsis')
  expect(cmd.flags['skip-ellipsis']).toBeTrue
  cmd = await AutocompleteInit.mock('-e')
  expect(cmd.flags['skip-ellipsis']).toBeTrue
})
