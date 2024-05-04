import fs from "fs";
import {mkdirRecursive} from "../src/fs-util.js";
import NpmInstaller from "../src/NpmInstaller.js";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 3600*1000;

/*
todo:
x parallell
x progress
x .INCOMPLETE
x full
x tailwind
x reload info if not found
x override
x dependenciesKey
- quick
*/

describe("npm installer",()=>{
	it("can install",async()=>{
		await mkdirRecursive("tmp/package",{fs});
		let c=fs.readFileSync("spec/data/test-package.json","utf8");
		fs.writeFileSync("tmp/package/package.json",c);

		let npmInstaller=new NpmInstaller({
			fs,
			cwd: "tmp/package",
			infoCache: "tmp/info-cache",
			//quick: true,
			/*overrides: {
				qql: "https://github.com/limikael/qql/archive/refs/heads/master.tar.gz"
			},*/
			//onProgress: (state,percent)=>console.log(state+": "+percent),
			//full: true
		});

		await npmInstaller.run();
		//console.log(npmInstaller.warnings);
	});
});