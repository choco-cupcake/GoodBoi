const { spawnSync } = require('child_process');

main()

async function main(){
  await launchVerifiedGetter()
}
/** 
 * Needed as to launch chrome on the server I need to emulate a display. ""need"" aka best solution I found
 * xvfb-run -a --server-args="-screen 0 1280x800x24 -ac -nolisten tcp -dpi 96 +extension RANDR" node services/verifiedGetter.js
 */
async function launchVerifiedGetter(){
  console.log("Current directory:", process.cwd())
  let spawnParams = ['-a', '--server-args="-screen 0 1280x800x24 -ac -nolisten tcp -dpi 96 +extension RANDR"', 'node', 'services/verifiedGetter.js']
  // run slither
  const slitherProg = spawnSync('xvfb-run', spawnParams); 
  let out = slitherProg.stdout.toString()
  console.log(out)
}