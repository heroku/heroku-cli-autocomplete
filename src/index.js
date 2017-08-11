// @flow

import klaw from 'klaw-sync'

export const topic = {
  name: 'ac',
  description: 'manage cli autocompletion',
  hidden: true
}

export const commands = klaw(__dirname, {nodir: true})
  .filter(f => f.path.endsWith('.js'))
  .filter(f => !f.path.endsWith('.test.js'))
  .filter(f => f.path !== __filename)
  .map(f => require(f.path))
