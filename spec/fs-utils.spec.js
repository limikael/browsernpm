import fs from "fs";
import {mkdirRecursive} from "../src/fs-util.js";

describe("fsutil",()=>{
	it("can mkdir recursive",async ()=>{
		await mkdirRecursive(fs.promises,"spec/data/1/2/3/4");
	});
});
