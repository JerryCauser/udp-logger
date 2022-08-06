const lib = require('./index.js')

import('../tests/_main.js')
  .then(async ({ default: _main }) => {
    _main('CJS', { ...lib })
      .then(() => process.exit(0))
      .catch((e) => {
        console.error(e)
        process.exit(1)
      })
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
