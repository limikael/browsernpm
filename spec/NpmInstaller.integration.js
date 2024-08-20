import fs from "fs";
import path from "path";
import {fileURLToPath} from 'url';
import {createDebugFetch} from "../src/utils/debug-util.js";
import {installDependencies} from "../src/lib/browsernpm.js";
import NpmRepo from "../src/lib/NpmRepo.js";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

jasmine.DEFAULT_TIMEOUT_INTERVAL=60*60*1000;

describe("NpmInstaller",()=>{
	it("works",async ()=>{
		let installTo=path.join("tmp/integration-installed");
		let installFrom=path.join(__dirname,"data/NpmInstaller-integration/testpackage");
//		let installFrom=path.join(__dirname,"data/NpmInstaller-integration/testpackage2");
		await fs.promises.rm(installTo,{recursive: true, force: true});
		await fs.promises.cp(installFrom,installTo,{recursive: true});

		let res=await installDependencies({
			cwd: installTo,
			//fetch: createDebugFetch(),
			fs: fs,
			casDir: "tmp/integration-cas",
			infoDir: "tmp/integration-info",
			ignore: ["katnip-cloudflare","katnip-watch"],
			onProgress: (state,percent)=>{
				console.log(state+": "+percent);
			}
		});
		console.log(res);
	});

	/*it("has a corner case",async ()=>{
		let installTo=path.join("tmp/corner");
		await fs.promises.rm(installTo,{recursive: true, force: true});

		let npmRepo=new NpmRepo({fs:fs});
		await npmRepo.downloadPackage(
			"fsmix",
			"https://github.com/limikael/fsmix/archive/refs/heads/master.tar.gz",
			"tmp/corner"
		);
	});*/
});
