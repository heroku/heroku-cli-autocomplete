import {expect, test} from '@oclif/test'

const {default: runtest} = require('../../helpers/runtest')

runtest('autocomplete:script', () => {
  test
  .stdout()
  .command(['autocomplete:script', 'bash'])
  .it('outputs bash profile config', ctx => {
    expect(ctx.stdout).to.contain(`
# heroku autocomplete setup
HEROKU_AC_BASH_SETUP_PATH=${
    ctx.config.cacheDir
  }/autocomplete/bash_setup && test -f $HEROKU_AC_BASH_SETUP_PATH && source $HEROKU_AC_BASH_SETUP_PATH;
`
    )
  })

  test
  .stdout()
  .command(['autocomplete:script', 'zsh'])
  .it('outputs zsh profile config', ctx => {
    expect(ctx.stdout).to.contain(`
# heroku autocomplete setup
HEROKU_AC_ZSH_SETUP_PATH=${
    ctx.config.cacheDir
  }/autocomplete/zsh_setup && test -f $HEROKU_AC_ZSH_SETUP_PATH && source $HEROKU_AC_ZSH_SETUP_PATH;
`
    )
  })

  test
  .stdout()
  .command(['autocomplete:script', 'fish'])
  .catch(e => {
    expect(e.message).to.contain('No autocomplete script for fish. Run $ heroku autocomplete for install instructions.')
  })
  .it('errors on unsupported shell')
})
