import fs from "fs";
import {mkdirRecursive} from "../src/fs-util.js";

describe("fsutil",()=>{
	it("can mkdir recursive",async ()=>{
		await mkdirRecursive("tmp/1/2/3/4",{fs});
		expect(fs.existsSync("tmp/1/2/3/4")).toEqual(true);
	});
});
