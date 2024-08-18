import fs from "fs";
import path from "path";
import {fileURLToPath} from 'url';
import {createDebugFetch} from "../src/utils/debug-util.js";
import urlJoin from "url-join";
import NpmInstaller from "../src/lib/NpmInstaller.js";

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
		await fs.promises.rm(installTo, {recursive: true, force: true});
		await fs.promises.cp(
			path.join(__dirname,"data/NpmInstaller/testpackage"),
			path.join("tmp/installed-testpackage"),
			{recursive: true}
		);

		let npmInstaller=new NpmInstaller({
			cwd: installTo,
			fetch: createDebugFetch(),
			fs: fs,
			casDir: path.join(__dirname,"data/NpmInstaller/cas")
		});

		await npmInstaller.run();

		/*let dep=await npmInstaller.createDependency("firstpackage","^1.0.0");
		expect(dep.resolvedVersion).toEqual("1.0.1");
		console.log(JSON.stringify(dep.getTree(),null,2));*/
	});
})