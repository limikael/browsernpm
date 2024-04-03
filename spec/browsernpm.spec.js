import {resolveDependencies, installDependencies} from "../src/browsernpm.js";
import fs from "fs";
import path from "path";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 3600*1000;

describe("browsernpm",()=>{
	/*it("can resolve deps",async ()=>{
		let dependencies={
			"wrangler": "^3.37.0",
			"preact": "^10.0.0",
			"fullstack-utils": "^1.0.8",
			"katnip-isoq": "^3.0.16",
		};

		let res=await resolveDependencies({
			dependencies: dependencies,
			fsPromises: fs.promises,
			path: path,
			infoCache: "spec/data/info-cache",
			onProgress: p=>console.log("Info: "+p)
		});

		console.log(res);
	});*/

	it("can install",async ()=>{
		let res=await installDependencies({
			cwd: "mypackage",
			fsPromises: fs.promises,
			path: path,
			infoCache: "spec/data/info-cache",
			onProgress: (state,p)=>console.log(state+": "+p)
		});

		console.log(res);
	});
});
