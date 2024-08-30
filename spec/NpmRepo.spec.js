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
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg")
		});

		let info=await npmRepo.loadPackageInfo("katnip");
		expect(info.name).toEqual("katnip");

		let ver=await npmRepo.getSatisfyingVersion("katnip","^3.0.27");
		expect(ver).toEqual("3.0.28");
	});

	it("doesn't load package info for url deps",async ()=>{
		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg")
		});

		let ver=await npmRepo.getSatisfyingVersion("katnip","https://github/bla");
		expect(ver).toEqual("https://github/bla");
	});

	it("can load package info with @user/package",async ()=>{
		let infoDir="tmp/info-cache2";
		await fs.promises.rm(infoDir,{recursive: true, force: true});

		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg"),
			infoDir: infoDir
		});

		let info=await npmRepo.loadPackageInfo("@user/package");
		let ver=await npmRepo.getSatisfyingVersion("@user/package","^1.0.0");
		expect(ver).toEqual("1.0.1");

		expect(await exists(path.join(infoDir,"@user+package"),{fs:fs})).toEqual(true);

		let deps=await npmRepo.getVersionDependencies("@user/package","1.0.1");
		//console.log(deps);
		expect(deps.firstpackage).toEqual("^1.0.0");
	});

	it("loads package info from cache",async ()=>{
		let infoDir="tmp/info-cache";
		await fs.promises.rm(infoDir,{recursive: true, force: true});

		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg"),
			infoDir: infoDir
		});

		let ver=await npmRepo.getSatisfyingVersion("katnip","^3.0.27");
		expect(await exists(path.join(infoDir,"katnip"),{fs})).toEqual(true);
		expect(npmRepo.fetch.urls.length).toEqual(1);

		npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg"),
			infoDir: infoDir
		});

		ver=await npmRepo.getSatisfyingVersion("katnip","^3.0.27");
		expect(ver).toEqual("3.0.28");
		expect(npmRepo.fetch.urls.length).toEqual(0);
	});

	it("invalidates the cache",async ()=>{
		let infoDir="tmp/info-cache";
		await fs.promises.rm(infoDir,{recursive: true, force: true});
		await fs.promises.mkdir(infoDir,{recursive: true});
		await fs.promises.cp(
			path.join(__dirname,"data/NpmRepo-info/katnip-3.0.25-info.json"),
			path.join(infoDir,"katnip")
		);

		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg"),
			infoDir: infoDir
		});

		let ver=await npmRepo.getSatisfyingVersion("katnip","^3.0.25");
		expect(ver).toEqual("3.0.25");
		expect(npmRepo.fetch.urls.length).toEqual(0);

		let ver2=await npmRepo.getSatisfyingVersion("katnip","^3.0.27");
		expect(ver2).toEqual("3.0.28");
	});

	it("can install a package",async ()=>{
		let installTo="tmp/katnip-install";
		await fs.promises.rm(installTo,{recursive: true, force: true});

		let npmRepo=new NpmRepo({
			fetch: createDebugFetch({
				rewrite: u=>{
					if (u=="https://registry.npmjs.org/katnip/-/katnip-3.0.25.tgz")
						return "file://"+path.join(__dirname,"data/NpmRepo-tar/katnip-3.0.25.tgz");

					return u;
				}
			}),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg"),
		});

		await npmRepo.downloadPackage("katnip","3.0.25",installTo);
		expect(await exists(path.join(installTo,"package.json"),{fs})).toEqual(true);
	});

	it("can list cas entries",async ()=>{
		let casDir=path.join(__dirname,"/../tmp/cas");
		await fs.promises.rm(casDir,{recursive: true, force: true});
		await fs.promises.mkdir(casDir,{recursive: true});

		await fs.promises.writeFile(path.join(casDir,"test@1.0.0"),"test");
		await fs.promises.writeFile(path.join(casDir,"test@1.0.1"),"test");
		await fs.promises.writeFile(path.join(casDir,"test2@1.0.1"),"test");

		let npmRepo=new NpmRepo({
			fs: fs,
			casDir: casDir
		});

		expect(await npmRepo.getSatisfyingVersion("test","^1.0.0")).toEqual("1.0.1");
		//console.log(await npmRepo.getCasKeys());
	});

	it("downloads to cas",async ()=>{
		let installTo=path.join(__dirname,"/../tmp/cas-katnip-install");
		await fs.promises.rm(installTo,{recursive: true, force: true});

		let casDir=path.join(__dirname,"/../tmp/cas-cas");
		await fs.promises.rm(casDir,{recursive: true, force: true});
		let npmRepo=new NpmRepo({
			casDir: casDir,
			fetch: createDebugFetch({
				rewrite: u=>{
					if (u=="https://registry.npmjs.org/katnip/-/katnip-3.0.25.tgz")
						return "file://"+path.join(__dirname,"data/NpmRepo-tar/katnip-3.0.25.tgz");

					if (u.includes("$REG") && u.includes("@user/package/-/package-1.0.1.tgz")) {
						u=u.replace("$REG","file://"+path.join(__dirname,"data/NpmRepo-tar"));
						u=u.replace("@user/package/-/package-1.0.1.tgz","@user+package-1.0.1.tgz");
						return u;
					}

					return u;
				}
			}),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg"),
		});

		await npmRepo.install("katnip","3.0.25",path.join(installTo,"katnip"));
		await npmRepo.install("@user/package","1.0.1",path.join(installTo,"@user/package"));

		let installToAgain=path.join(__dirname,"/../tmp/cas-katnip-install-2");
		await fs.promises.rm(installToAgain,{recursive: true, force: true});

		await npmRepo.install("katnip","3.0.25",path.join(installToAgain,"katnip"));
		await npmRepo.install("@user/package","1.0.1",path.join(installToAgain,"@user/package"));
		//console.log(npmRepo.fetch.urls);
		expect(npmRepo.fetch.urls.length).toEqual(4); // one for info, one for download for each of 2 pkgs
	});

	it("can get dependencies via info",async ()=>{
		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg"),
		});

		let ver=await npmRepo.getSatisfyingVersion("katnip","^3.0.27");
		expect(ver).toEqual("3.0.28");

		let dependencies=await npmRepo.getVersionDependencies("katnip","3.0.28");
		expect(dependencies.json5).toEqual("^2.2.3");
	});

	it("can get dependencies via url",async ()=>{
		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg"),
		});

		let u="file://"+path.join(__dirname,"data/NpmRepo-tar/katnip-3.0.25.tgz");
		let dependencies=await npmRepo.getVersionDependencies("katnip",u);
		expect(dependencies.json5).toEqual("^2.2.3");
	});

	it("can get dependencies via cas",async ()=>{
		let casDir=path.join(__dirname,"data/NpmRepo-cas");

		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			casDir: casDir,
			fs
		});

		let ver=await npmRepo.getSatisfyingVersion("katnip","^3.0.27");
		expect(ver).toEqual("3.0.28");
		let dependencies=await npmRepo.getVersionDependencies("katnip","3.0.28");
		//console.log(dependencies);
		expect(dependencies.dummydep).toEqual("^1.2.3");

		let dependencies2=await npmRepo.getVersionDependencies("katnip","3.0.28");
		expect(dependencies2.dummydep).toEqual("^1.2.3");
	});

	it("can bypass the cas",async ()=>{
		let casDir=path.join(__dirname,"/../tmp/cas-bypass");
		await fs.promises.rm(casDir,{recursive: true, force: true});
		await fs.promises.cp(
			path.join(__dirname,"data/NpmRepo-cas"),
			casDir,
			{recursive: true}
		);

		let installTo=path.join(__dirname,"/../tmp/cas-bypass-install");
		await fs.promises.rm(installTo,{recursive: true, force: true});

		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			casDir: casDir,
			casOverride: ["katnip"],
			fs
		});

		let packageUrl="file://"+path.join(__dirname,"data/NpmRepo-tar/katnip-3.0.25.tgz");
		let deps=await npmRepo.getVersionDependencies("katnip",packageUrl);

		await npmRepo.install(
			"katnip",
			packageUrl,
			path.join(installTo,"node_modules/katnip")
		);

		expect(fs.existsSync(path.join(casDir,npmRepo.serializePackageSpec("katnip",packageUrl)))).toEqual(false);
	});
});