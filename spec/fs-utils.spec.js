import fs from "fs";
//import {mkdirRecursive} from "../src/utils/fs-util.js";

describe("fsutil",()=>{
	it("can mkdir recursive",async ()=>{
		//await mkdirRecursive("tmp/1/2/3/4",{fs});
		await fs.promises.mkdir("tmp/1/2/3/4",{recursive: true});
		expect(fs.existsSync("tmp/1/2/3/4")).toEqual(true);
	});
});
