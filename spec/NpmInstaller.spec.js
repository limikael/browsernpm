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

	it("can install",async ()=>{
		let installTo=path.join("tmp/installed-testpackage");
		let installFrom=path.join(__dirname,"data/NpmInstaller/testpackage");
		await fs.promises.rm(installTo,{recursive: true, force: true});
		await fs.promises.cp(installFrom,installTo,{recursive: true});

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas")
		});

		await npmInstaller.run();
		expect(await exists(path.join(installTo,"node_modules"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage/"),{fs:fs})).toEqual(true);
		expect(await exists(path.join(installTo,"node_modules/firstpackage/node_modules/firstdep/node_modules/firstsubdep/package.json"),{fs:fs})).toEqual(true);
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