import * as lib from '../index.js'
import _main from './_main.js'

_main('ESM', { ...lib })
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
