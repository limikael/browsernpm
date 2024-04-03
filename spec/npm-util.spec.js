import {semverComputeSets, semverMaxSatisfyingAll} from "../src/npm-util.js";
import semver from "semver";
import fs from "fs";
import path from "path";

describe("npm-util.js",()=>{
	it("works",async ()=>{
		let esbuildInfo=JSON.parse(fs.readFileSync("spec/data/esbuild-info.json","utf8"));
		let versions=Object.keys(esbuildInfo.versions);
		let sets=semverComputeSets(["^0.19.2","^0.19.3","0.17.19"]);
		let max=sets.map(set=>semverMaxSatisfyingAll(versions,set));

		//console.log(sets);
		//console.log(max);

		expect(sets).toEqual([ [ '^0.19.2', '^0.19.3' ], [ '0.17.19' ] ]);
		expect(max).toEqual([ '0.19.12', '0.17.19' ]);
	});
});