import {createDebugFetch} from "../src/utils/debug-util.js";
import NpmRepo from "../src/lib/NpmRepo.js";
import fs from "fs";
import urlJoin from "url-join";
import path from "path";
import {fileURLToPath} from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("NpmRepo",()=>{
	it("can get package deps from filesystem",async ()=>{
		let npmRepo=new NpmRepo({
			//fetch: createDebugFetch(),
			fs,
			//registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg")
		});

		let deps=await npmRepo.getVersionDependencies("testpackage",urlJoin("file://",__dirname,"data/NpmRepo-fs/testpackage"));
		expect(deps).toEqual({bla: "1.2.3", blu: "3.4.5"});
	});

	it("can install a package from the filesystem",async ()=>{
		let installTo="tmp/test-fs-install";
		await fs.promises.rm(installTo,{recursive: true, force: true});

		let npmRepo=new NpmRepo({
			//fetch: createDebugFetch(),
			fs,
			//registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg")
		});

		let url=urlJoin("file://",__dirname,"data/NpmRepo-fs/testpackage");
		await npmRepo.downloadPackage("testpackage",url,path.join(installTo,"testpackage"));

		let pkgJson=await fs.promises.readFile(path.join(installTo,"testpackage","package.json"));
		let pkg=JSON.parse(pkgJson);
		expect(pkg.__installedVersion).toEqual(url);
	});
});