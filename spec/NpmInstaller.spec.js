import fs from "fs";
import path from "path";
import {fileURLToPath} from 'url';
import {createDebugFetch} from "../src/utils/debug-util.js";
import urlJoin from "url-join";
import NpmInstaller from "../src/lib/NpmInstaller.js";
import {exists} from "../src/utils/fs-util.js";
import {installDependencies} from "../src/lib/browsernpm.js";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("NpmInstaller",()=>{
	it("can run as a function",async ()=>{
		let installTo=path.join("tmp/installed-fn");
		let installFrom=path.join(__dirname,"data/NpmInstaller/testpackage");
		await fs.promises.rm(installTo,{recursive: true, force: true});
		await fs.promises.cp(installFrom,installTo,{recursive: true});

		await installDependencies({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas"),
		});
	});

	it("can create a dependency",async ()=>{
		let npmInstaller=new NpmInstaller({
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas")
		});

		let dep=await npmInstaller.createDependency("firstpackage","^1.0.0");
		expect(dep.resolvedVersion).toEqual("1.0.1");
		//console.log(JSON.stringify(dep.getTree(),null,2));
	});

	it("can install without hoisting",async ()=>{
		let installTo=path.join("tmp/installed-testpackage");
		let installFrom=path.join(__dirname,"data/NpmInstaller/testpackage");
		await fs.promises.rm(installTo,{recursive: true, force: true});
		await fs.promises.cp(installFrom,installTo,{recursive: true});

		let progress=[];
		function handleProgress(state, percent) {
			progress.push({state, percent});
		}

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas"),
			dedupe: false,
			onProgress: handleProgress
		});

		await npmInstaller.run();
		expect(await exists(path.join(installTo,"node_modules"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage/"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage/node_modules/firstdep/node_modules/firstsubdep/package.json"),{fs:fs})).toEqual(true);

		//console.log(progress);
		expect(progress.length).toBeGreaterThan(2);
	});

	it("can install with hoisting",async ()=>{
		let installTo=path.join("tmp/installed-testpackage-dedupe");
		let installFrom=path.join(__dirname,"data/NpmInstaller/testpackage");
		await fs.promises.rm(installTo,{recursive: true, force: true});
		await fs.promises.cp(installFrom,installTo,{recursive: true});

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas"),
			//dedupe: true
		});

		await npmInstaller.run();
		expect(await exists(path.join(installTo,"node_modules"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage/"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstsubdep/package.json"),{fs:fs})).toEqual(true);

		for (let dep of npmInstaller.getAllDependencies())
			expect(await dep.isInstalled()).toEqual(true);
	});

	it("can hoist a package",async ()=>{
		let installTo=path.join("tmp/hoist-test");
		let installFrom=path.join(__dirname,"data/NpmInstaller/testpackage");
		await fs.promises.rm(installTo,{recursive: true, force: true});
		await fs.promises.cp(installFrom,installTo,{recursive: true});

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas"),
			dedupe: false
		});

		await npmInstaller.loadDependencies();
		expect(npmInstaller.getCompatibleDependencies("seconddep","2.0.0").length).toEqual(2);

		//console.log(JSON.stringify(npmInstaller.getTree(),null,2));
		let hoistDep;
		for (let dep of npmInstaller.getAllDependencies())
			if (dep.name=="seconddep" && dep.versionSpec=="2.0.0")
				hoistDep=dep;

		let versions=npmInstaller.getDependencyVersions("seconddep");
		expect(versions).toEqual(["2.0.0","1.0.0"]);
		let sat=versions.map(v=>npmInstaller.getSatisfiesCount("seconddep",v));
		expect(sat).toEqual([2,1]);

		let hoistableVersion=npmInstaller.findHoistableVersion("seconddep");
		expect(hoistableVersion).toEqual("2.0.0");

		let hoistableDependency=npmInstaller.findHoistableDependency("seconddep");
		expect(hoistableDependency.resolvedVersion).toEqual("2.0.0");

		hoistableDependency.hoist();

		//console.log(JSON.stringify(npmInstaller.getTree(),null,2));
		expect(npmInstaller.dependencies.length).toEqual(2);
	});

	it("handles circular dependencies",async ()=>{
		let installTo=path.join("tmp/installed-testcircular");
		await fs.promises.rm(installTo, {recursive: true, force: true});
		await fs.promises.cp(
			path.join(__dirname,"data/NpmInstaller/testcircular"),
			installTo,
			{recursive: true}
		);

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas")
		});

		await npmInstaller.run();
		expect(npmInstaller.warnings.length).toEqual(1);
		expect(npmInstaller.warnings[0].includes("Circular")).toEqual(true);
	});

	it("can install url dependencies",async ()=>{
		let installTo=path.join("tmp/installed-testurl");
		await fs.promises.rm(installTo, {recursive: true, force: true});
		await fs.promises.cp(
			path.join(__dirname,"data/NpmInstaller/testurl"),
			installTo,
			{recursive: true}
		);

		let casDir=path.join("tmp/testurl-cas");
		await fs.promises.rm(casDir, {recursive: true, force: true});
		await fs.promises.cp(
			path.join(__dirname,"data/NpmInstaller/cas"),
			casDir,
			{recursive: true}
		);

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch({
				rewrite: u=>{
					if (!u.includes("https://BASE"))
						throw new Error("unexpected url: "+u);

					u=u.replace("https://BASE",urlJoin("file://",__dirname,"data/NpmRepo-tar"))
					return u;
				}
			}),
			fs: fs,
			casDir: casDir,
		});

		await npmInstaller.run();
	});

	it("can ignore",async ()=>{
		let installTo=path.join("tmp/installed-testignore");
		let installFrom=path.join(__dirname,"data/NpmInstaller/testpackage");
		await fs.promises.rm(installTo,{recursive: true, force: true});
		await fs.promises.cp(installFrom,installTo,{recursive: true});

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas"),
			ignore: ["firstsubdep"]
		});

		await npmInstaller.run();
		expect(await exists("tmp/installed-testignore/node_modules/firstsubdep",{fs:fs})).toEqual(false);
	});

	it("cleans up and works with quick",async ()=>{
		let installTo=path.join("tmp/installed-cleanup");
		let installFrom=path.join(__dirname,"data/NpmInstaller/testpackage");
		await fs.promises.rm(installTo,{recursive: true, force: true});
		await fs.promises.cp(installFrom,installTo,{recursive: true});

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas"),
		});

		await npmInstaller.run();

		expect(await exists("tmp/installed-cleanup/node_modules/firstsubdep",{fs:fs})).toEqual(true);

		let npmInstaller2=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			full: true,
			casDir: path.join(__dirname,"data/NpmInstaller/cas"),
			ignore: ["firstsubdep"]
		});

		let res=await npmInstaller2.run();

		expect(await exists("tmp/installed-cleanup/node_modules/firstsubdep",{fs:fs})).toEqual(false);
		expect(res.removed).toEqual(2);

		let npmInstaller3=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas"),
			ignore: ["firstsubdep"],
			quick: true
		});

		let res3=await npmInstaller3.run();
		expect(res3.quick).toEqual(true);
	});

	it("overrides",async ()=>{
		let installTo=path.join("tmp/installed-override");
		let installFrom=path.join(__dirname,"data/NpmInstaller/testpackage");
		await fs.promises.rm(installTo,{recursive: true, force: true});
		await fs.promises.cp(installFrom,installTo,{recursive: true});

		let casDir=path.join("tmp/override-cas");
		await fs.promises.rm(casDir, {recursive: true, force: true});
		await fs.promises.cp(
			path.join(__dirname,"data/NpmInstaller/cas"),
			casDir,
			{recursive: true}
		);

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: casDir,
			override: {
				seconddep: urlJoin("file://",__dirname,"data/NpmRepo-tar/@user+package-1.0.1.tgz")
			}
		});

		await npmInstaller.run();
	});
})