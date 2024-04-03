/*import NpmPackage from "../src/NpmPackage.js";
import NpmRepo from "../src/NpmRepo.js";
import fs from "fs";
import path from "path";
import {semverComputeSets, semverMaxSatisfyingAll} from "../src/npm-util.js";
import semver from "semver";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 3600*1000;

describe("NpmPackage",()=>{
	it("works",async ()=>{
		let npmRepo=new NpmRepo({
			fsPromises: fs.promises,
			infoCache: "spec/data/info-cache"
		});

		let npmPackage=new NpmPackage({
			npmRepo: npmRepo,
			name: "mypackage",
			versionSpec: "root"
		});

		console.log();

		npmPackage.addEventListener("dependencyAdded",()=>{
			console.log("loading info: "+npmPackage.getLoadCompletion());
		});

		await npmPackage.addDependencies({
			"wrangler": "^3.37.0",
			"preact": "^10.0.0",
			"fullstack-utils": "^1.0.8",
			"katnip-isoq": "^3.0.16",
		});

		npmPackage.dedupe();
		//npmPackage.logTree();

		let lockFile=await npmPackage.getLockFile();
		//console.log(JSON.stringify(lockFile,null,2));
	});
});*/
