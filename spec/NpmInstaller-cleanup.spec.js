/*import fs from "fs";
import path from "path";
import {fileURLToPath} from 'url';
import {createDebugFetch} from "../src/utils/debug-util.js";
import urlJoin from "url-join";
import NpmInstaller from "../src/lib/NpmInstaller.js";
import {exists} from "../src/utils/fs-util.js";
import {installDependencies} from "../src/lib/browsernpm.js";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("npm intaller cleanup bug",()=>{
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

		console.log("---------");

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
});*/