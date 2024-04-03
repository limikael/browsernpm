/*import {PackageSpecs, PackageSpec} from "../src/PackageSpecs.js";
import NpmRepo from "../src/NpmRepo.js";
import fs from "fs";
import path from "path";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 3600*1000;

describe("NpmPackage",()=>{
	it("works",async ()=>{
		let npmRepo=new NpmRepo({
			fsPromises: fs.promises,
			infoCache: "spec/data/info-cache"
		});

		let packageSpecs=new PackageSpecs({
			npmRepo: npmRepo,
		});

		await packageSpecs.addSpec(new PackageSpec("wrangler","^3.37.0"));
		await packageSpecs.addSpec(new PackageSpec("preact", "^10.0.0"));
		await packageSpecs.addSpec(new PackageSpec("fullstack-utils", "^1.0.8"));
		await packageSpecs.addSpec(new PackageSpec("katnip-isoq", "^3.0.16"));

		//await npmPackage.addDependency("preact","^10.0.0");

		//console.log();
		//npmPackage.logTree();
	});
});*/
