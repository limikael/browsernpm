#!/usr/bin/env node

import yargs from "yargs/yargs";
import {hideBin} from "yargs/helpers";
import {installDependencies} from "../lib/browsernpm.js";
import fs from "fs";
import path from "path";

let yargsConf=yargs(hideBin(process.argv))
    .option("cwd",{
        description: "Project dir.",
	    default: process.cwd()
    })
    .option("registry-url",{
        description: "Alternative NPM registry url.",
    })
    .option("info-dir",{
        description: "Package info cache dir.",
    })
    .option("cas-dir",{
    	description: "Package cache dir."
    })
    .option("override",{
    	description: "Packages to override."
    })
    .command("install","Install project.")
    .command("show-options","Show options that would be used.")
    .demandCommand()
    .strict()
    .usage("browsernpm -- Very alternative NPM installer.")
    .epilog("Options will also be read from .browsernpm.json in the project dir")

let argv=yargsConf.parse();
let browsernpmJsonFn=path.join(argv.cwd,".browsernpm.json");
if (fs.existsSync(browsernpmJsonFn)) {
	let fileArgs=JSON.parse(fs.readFileSync(browsernpmJsonFn));
	console.log("Applying options from: "+browsernpmJsonFn);
	argv={...fileArgs,...argv};
}

switch (argv._[0]) {
	case "show-options":
		console.log(JSON.stringify(argv,null,2));
		break;

	case "install":
		function handleProgress(state, percent) {
			console.log(state+": "+percent);
		}

		await installDependencies({...argv, fs, onProgress: handleProgress});
		break;

	default:
		throw new Error("Unknown command: "+argv._[0]);
		break;
}
