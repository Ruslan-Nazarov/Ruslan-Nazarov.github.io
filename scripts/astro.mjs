import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['node_modules/astro/bin/astro.mjs',...process.argv.slice(2)],{
  stdio:'inherit',windowsHide:true,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}
});
child.on('error',error=>{console.error(error);process.exitCode=1});
child.on('exit',code=>process.exit(code??1));
