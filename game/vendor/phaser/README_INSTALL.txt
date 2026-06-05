Phaser is intentionally vendored locally for the Steam desktop build.

After applying Steam Desktop Wrapper Pass 2, run from the wrapper root:

  npm install phaser@3.70.0 --save-dev --save-exact
  npm run vendor:phaser
  npm run check:offline

This will copy node_modules/phaser/dist/phaser.esm.js into this folder as:

  game/vendor/phaser/phaser.esm.js

Do not commit or ship the wrapper without phaser.esm.js present.
