const net = require('node:net')
const assert = require('node:assert')

console.log('Testing ')
import('../tests/_main.js')
  .then(async ({ default: _main }) => {
    _main({
      net,
      assert
    }).catch((e) => {
      console.error(e)
      process.exit(1)
    })
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
