import * as lib from '../index.js'
import * as identifier from '../src/identifier.js'
import * as constants from '../src/constants.js'
import _main from './_main.js'

_main('ESM', { ...lib, identifier, constants }).catch((e) => {
  console.error(e)
  process.exit(1)
})
