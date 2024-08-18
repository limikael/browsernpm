import {semverComputeSets, semverMaxSatisfyingAll, semverNiceMax} from "../src/utils/npm-util.js";
import semver from "semver";
import fs from "fs";
import path from "path";

describe("npm-util.js",()=>{
	it("works",async ()=>{
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

	/*it("works with urls",()=>{
		let sets=semverComputeSets(["^0.19.2","https://test.com/bla","^0.19.3","0.17.19","https://test.com/bla"]);
		console.log(sets);

		let esbuildInfo=JSON.parse(fs.readFileSync("spec/data/esbuild-info.json","utf8"));
		let versions=Object.keys(esbuildInfo.versions);

		let max=sets.map(set=>semverMaxSatisfyingAll(versions,set));
		max.sort(semver.rcompare);

		console.log(max);
	});*/
});