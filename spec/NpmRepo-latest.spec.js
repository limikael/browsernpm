import {createDebugFetch} from "../src/utils/debug-util.js";
import NpmRepo from "../src/lib/NpmRepo.js";
import fs from "fs";
import urlJoin from "url-join";
import path from "path";
import {fileURLToPath} from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("NpmRepo",()=>{
	it("can resolve latest version",async ()=>{
		let npmRepo=new NpmRepo({
			fetch: createDebugFetch(),
			fs,
			registryUrl: urlJoin("file://",__dirname,"data/NpmRepo-reg")
		});

		let info=await npmRepo.loadPackageInfo("katnip");
		expect(info.name).toEqual("katnip");

		let ver=await npmRepo.getSatisfyingVersion("katnip","latest");
		expect(ver).toEqual("3.0.28");
	});
});