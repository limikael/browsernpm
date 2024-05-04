import fs from "fs";
import {installDependencies} from "../src/browsernpm.js";

await installDependencies({
	fs,
	cwd: "mypackage",
	infoCache: "tmp/info-cache",
	overrides: {
		"isoq-router": "http://localhost:3000/npm/isoq-router.tgz",
		"katnip": "http://localhost:3000/npm/katnip.tgz",
		"katnip-isoq": "http://localhost:3000/npm/katnip-isoq.tgz",
	},
	//onProgress: (state,percent)=>console.log(state+": "+percent),
	//quick: true,
	//full: true
});