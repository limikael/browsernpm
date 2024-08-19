import {semverComputeSets, semverMaxSatisfyingAll, 
		semverNiceMax, getInstalledPackagePaths} from "../src/utils/npm-util.js";
import semver from "semver";
import fs from "fs";
import path from "path";
import {fileURLToPath} from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("npm-util.js",()=>{
	it("can compute sets",async ()=>{
		let esbuildInfo=JSON.parse(fs.readFileSync("spec/data/npm-util/esbuild-info.json","utf8"));
		let versions=Object.keys(esbuildInfo.versions);
		let sets=semverComputeSets(["^0.19.2","^0.19.3","0.17.19"]);
		let max=sets.map(set=>semverMaxSatisfyingAll(versions,set));

		//console.log(sets);
		//console.log(max);

		expect(sets).toEqual([ [ '^0.19.2', '^0.19.3' ], [ '0.17.19' ] ]);
		expect(max).toEqual([ '0.19.12', '0.17.19' ]);
	});

	it("can pick a nice max",()=>{
		let res;
		res=semverNiceMax(["1.0.0","1.0.2","1.0.1"])
		//console.log(res);
		expect(res).toEqual("1.0.2");

		res=semverNiceMax(["http://blabla","1.0.0","1.0.2","1.0.1"])
		//console.log(res);
		expect(res).toEqual("1.0.2");

		res=semverNiceMax(["http://blabla"])
		//console.log(res);
		expect(res).toEqual("http://blabla");
	});

	it("can list all package dirs",async ()=>{
		let dir="spec/data/npm-util/testpackage";
		let pathnames=await getInstalledPackagePaths(dir,{fs:fs})
		//console.log(pathnames);
		expect(pathnames.length).toEqual(5);
	});
});