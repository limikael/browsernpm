import urlJoin from "url-join";
import semver from "semver";
import {semverComputeSets, semverMaxSatisfyingAll} from "./npm-util.js";
import path from "path";
import {exists} from "./fs-util.js";

async function loadPackageInfo(packageName) {
	console.log("loading: "+packageName);
	let response=await fetch(urlJoin("https://registry.npmjs.org/",packageName));
	if (response.status<200 || response.status>=300)
		throw new Error("Can't get package info: "+response.status);

	return await response.json();
}

class Dependency {
	constructor(name) {
		this.name=name;
		this.versionSpecs=[];
	}

	async load() {
		if (this.tree.infoCache) {
			let infoJsonPath=path.join(this.tree.infoCache,this.name+".json");
			if (await exists(this.tree.fsPromises,infoJsonPath)) {
				this.info=JSON.parse(
					await this.tree.fsPromises.readFile(infoJsonPath,"utf8")
				);

				return;
			}

			this.info=await loadPackageInfo(this.name);
			await this.tree.fsPromises.mkdir(path.dirname(infoJsonPath),{recursive: true});
			await this.tree.fsPromises.writeFile(
				path.join(this.tree.infoCache,this.name+".json"),
				JSON.stringify(this.info)
			);
		}

		else {
			this.info=await loadPackageInfo(this.name);
		}
	}

	addVersionSpec(spec) {
		if (!this.versionSpecs.includes(spec)) {
			//console.log(this.name+" "+spec);
			this.versionSpecs.push(spec);
		}
	}

	getVersionsToUse() {
		let sets=semverComputeSets(this.versionSpecs);
		let available=Object.keys(this.info.versions);
		let using=sets.map(set=>semverMaxSatisfyingAll(available,set));
		using.sort(semver.rcompare);

		return using;
	}
}

export default class DependencyTree {
	constructor({infoCache, fsPromises}) {
		this.infoCache=infoCache;
		this.fsPromises=fsPromises;
		this.dependencies={};
	}

	async addDependency(packageName, versionSpec) {
		if (this.dependencies[packageName] &&
				this.dependencies[packageName].versionSpecs.includes(versionSpec))
			return;

		if (!this.dependencies[packageName]) {
			let dependency=new Dependency(packageName);
			dependency.tree=this;
			this.dependencies[packageName]=dependency;
			await dependency.load();
		}

		let dependency=this.dependencies[packageName];
		dependency.addVersionSpec(versionSpec);

		let useVersions=dependency.getVersionsToUse();

		for (let useVersion of useVersions) {
			let dependencies=dependency.info.versions[useVersion].dependencies;

			if (!dependencies)
				return;

			for (let k in dependencies)
				await this.addDependency(k,dependencies[k]);
		}
	}

	getDependencyVersions() {
		let ret={};
		for (let dependencyName in this.dependencies)
			ret[dependencyName]=this.dependencies[dependencyName].getVersionsToUse();

		return ret;
	}

	getPackageInfo(packageName) {
		return this.dependencies[packageName].info;
	}
}