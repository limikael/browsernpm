/*import NpmRepo from "../src/NpmRepo.js";
import fs from "fs";

describe("NpmRepo",()=>{
	it("works",async ()=>{
		let npmRepo=new NpmRepo({
			fsPromises: fs.promises,
			infoCache: "spec/data/info-cache"
		});

		let esbuildInfo=await npmRepo.getPackageInfo("esbuild");
		expect(Object.keys(esbuildInfo.versions).length).toBeGreaterThan(0);

		let esbuildInfo2=await npmRepo.getPackageInfo("esbuild");
		expect(Object.keys(esbuildInfo2.versions).length).toBeGreaterThan(0);
	});
});*/