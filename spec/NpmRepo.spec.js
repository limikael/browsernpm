import path from "path";
import {fileURLToPath} from 'url';
import {createDebugFetch} from "../src/utils/debug-util.js";
import NpmRepo from "../src/lib/NpmRepo.js";
import fs from "fs";
import urlJoin from "url-join";
import {exists} from "../src/utils/fs-util.js";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("NpmRepo",()=>{
	it("can load package info",async ()=>{
		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/reg-1")
		});

		let info=await npmRepo.loadPackageInfo("katnip");
		expect(info.name).toEqual("katnip");

		let ver=await npmRepo.getSatisfyingVersion("katnip","^3.0.27");
		expect(ver).toEqual("3.0.28");
	});

	it("loads package info from cache",async ()=>{
		let infoDir=path.join(__dirname,"tmp/info-cache");
		await fs.promises.rm(infoDir,{recursive: true, force: true});

		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/reg-1"),
			infoDir: infoDir
		});

		let ver=await npmRepo.getSatisfyingVersion("katnip","^3.0.27");
		expect(await exists(path.join(infoDir,"katnip"),{fs})).toEqual(true);
		expect(npmRepo.fetch.urls.length).toEqual(1);

		npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/reg-1"),
			infoDir: infoDir
		});

		ver=await npmRepo.getSatisfyingVersion("katnip","^3.0.27");
		expect(ver).toEqual("3.0.28");
		expect(npmRepo.fetch.urls.length).toEqual(0);
	});

	it("invalidates the cache",async ()=>{
		let infoDir=path.join(__dirname,"tmp/info-cache");
		await fs.promises.rm(infoDir,{recursive: true, force: true});
		await fs.promises.mkdir(infoDir,{recursive: true});
		await fs.promises.cp(path.join(__dirname,"data/katnip-3.0.25-info.json"),path.join(infoDir,"katnip"));

		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/reg-1"),
			infoDir: infoDir
		});

		let ver=await npmRepo.getSatisfyingVersion("katnip","^3.0.25");
		expect(ver).toEqual("3.0.25");
		expect(npmRepo.fetch.urls.length).toEqual(0);

		let ver2=await npmRepo.getSatisfyingVersion("katnip","^3.0.27");
		expect(ver2).toEqual("3.0.28");
	});

	it("can install a package",async ()=>{
		let installTo=path.join(__dirname,"/../tmp/katnip-install");
		await fs.promises.rm(installTo,{recursive: true, force: true});

		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/reg-1"),
			rewriteTarballUrl: u=>{
				if (u=="https://registry.npmjs.org/katnip/-/katnip-3.0.25.tgz")
					return "file://"+path.join(__dirname,"data/katnip-3.0.25.tgz");

				throw new Error("Unexpected tarball url: "+u);
			}
		});

		await npmRepo.install("katnip","3.0.25",installTo);
		expect(await exists(path.join(installTo,"package.json"),{fs})).toEqual(true);
	});
});