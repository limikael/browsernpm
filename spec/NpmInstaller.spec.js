import fs from "fs";
import path from "path";
import {fileURLToPath} from 'url';
import {createDebugFetch} from "../src/utils/debug-util.js";
import urlJoin from "url-join";
import NpmInstaller from "../src/lib/NpmInstaller.js";
import {exists} from "../src/utils/fs-util.js";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("NpmInstaller",()=>{
	it("can create a dependency",async ()=>{
		let npmInstaller=new NpmInstaller({
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas")
			//rewriteTarballUrl, 
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

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas"),
			dedupe: false
		});

		await npmInstaller.run();
		expect(await exists(path.join(installTo,"node_modules"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage/"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage/node_modules/firstdep/node_modules/firstsubdep/package.json"),{fs:fs})).toEqual(true);
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
})