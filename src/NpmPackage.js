import semver from "semver";
import {semverComputeSets, semverMaxSatisfyingAll} from "./npm-util.js";
import {arrayRemove} from "./js-util.js";
import {arrayOnlyUnique} from "./js-util.js";
import path from "path-browserify";

export default class NpmPackage extends EventTarget {
	constructor({npmRepo, name, versionSpec}) {
		super();

		this.npmRepo=npmRepo;
		this.name=name;
		this.versionSpec=versionSpec;

		this.dependencies=[];
		this.warnings=[];
	}

	isCircular(name, versionSpec) {
		if (this.name==name && this.versionSpec==versionSpec)
			return true;

		if (!this.parent)
			return false;

		return this.parent.isCircular(name,versionSpec);
	}

	async addDependency(name, versionSpec) {
		if (!semver.validRange(versionSpec)) {
			this.findRoot().warnings.push("Not valid semver range: "+versionSpec+" referenced by: "+this.name);
			return;
		}

		/*if (versionSpec.includes("npm")) {
			console.log(this.name,name,versionSpec);
			//process.exit();
		}*/


		if (this.isCircular(name,versionSpec)) {
			//console.log("** circular "+name+" "+versionSpec);
			return;
		}

		//console.log("adding: "+name+" "+versionSpec);

		let npmPackage=new NpmPackage({
			npmRepo: this.npmRepo,
			name: name,
			versionSpec: versionSpec,
		});

		npmPackage.parent=this;
		this.dependencies.push(npmPackage);

		await npmPackage.loadDependencies();
		this.findRoot().dispatchEvent(new Event("dependencyAdded"));
	}

	async addDependencies(dependencies) {
		let promises=[];
		for (let k in dependencies)
			promises.push(this.addDependency(k,dependencies[k]));

		this.depInit=true;

		await Promise.all(promises);
	}

	getLoadCompletion() {
		if (!this.depInit)
			return 0;

		if (!this.dependencies.length)
			return 100;

		let total=0;
		for (let dependency of this.dependencies)
			total+=dependency.getLoadCompletion();

		return Math.round(total/this.dependencies.length);
	}

	async loadDependencies() {
		this.dependencies=[];

		let info=await this.npmRepo.getPackageInfo(this.name);
		let matchedVersion=semver.maxSatisfying(Object.keys(info.versions),this.versionSpec);
		this.version=matchedVersion;

		//console.log(this.name+" "+this.versionSpec+" "+matchedVersion+" info.versions[matchedVersion]: ",info.versions[matchedVersion]);

		let dependencies=info.versions[matchedVersion].dependencies;
		if (!dependencies)
			dependencies=[];

		let promises=[];
		for (let k in dependencies)
			promises.push(this.addDependency(k,dependencies[k]));

		this.depInit=true;

		await Promise.all(promises);
	}

	findAllVersionSpecs(packageName) {
		let all=[];

		if (packageName==this.name && this.versionSpec)
			all.push(this.versionSpec);

		for (let dependency of this.dependencies)
			all=[...all,...dependency.findAllVersionSpecs(packageName)];

		return all;
	}

	findAllUsedVersions(packageName) {
		let all=[];

		if (packageName==this.name && this.version)
			all.push(this.version);

		for (let dependency of this.dependencies)
			all=[...all,...dependency.findAllUsedVersions(packageName)];

		return all;
	}

	isRoot() {
		return !this.parent;
	}

	findRoot() {
		if (this.isRoot())
			return this;

		return this.parent.findRoot();
	}

	findHoistableVersion(packageName) {
		if (!this.isRoot())
			throw new Error("Can only hoist at root");

		let allSpecs=this.findAllVersionSpecs(packageName);
		let versions=this.findAllUsedVersions(packageName);
		let sets=semverComputeSets(allSpecs);
		let max=sets.map(set=>semverMaxSatisfyingAll(versions,set));
		max.sort(semver.rcompare);

		return max[0];
	}

	findPackage(packageName, version) {
		if (this.name==packageName && this.version==version)
			return this;

		for (let dependency of this.dependencies) {
			let cand=dependency.findPackage(packageName,version);
			if (cand)
				return cand;
		}
	}

	removePackage(npmPackage) {
		npmPackage.parent=null;
		arrayRemove(this.dependencies,npmPackage);
	}

	removeCompatibleVersions(packageName, version) {
		/*if (this.name==packageName) {
			console.log("found: "+this.name+" "+this.versionSpec);
		}*/

		if (this.name==packageName &&
				this.versionSpec &&
				semver.satisfies(version,this.versionSpec))
			this.parent.removePackage(this);

		for (let dependency of [...this.dependencies])
			dependency.removeCompatibleVersions(packageName,version);
	}

	hoist(packageName, version) {
		if (!this.isRoot())
			throw new Error("Can only hoist at root");

		let npmPackage=this.findPackage(packageName, version);
		this.removeCompatibleVersions(packageName,version);

		npmPackage.versionSpec=null;
		npmPackage.parent=this;
		this.dependencies.push(npmPackage);
	}

	getAllDependencyNames() {
		let allNames=[];
		if (!this.isRoot())
			allNames.push(this.name);

		for (let dependency of this.dependencies)
			allNames.push(...dependency.getAllDependencyNames());

		return allNames;
	}

	dedupe() {
		if (!this.isRoot())
			throw new Error("Dedupe should be run at root");

		let allNames=arrayOnlyUnique(this.getAllDependencyNames());

		for (let packageName of allNames) {
			let version=this.findHoistableVersion(packageName);
			this.hoist(packageName,version);
		}
	}

	async getLockFile(installPath) {
		if (!installPath)
			installPath="";

		let entries=[];

		if (!this.isRoot()) {
			installPath=path.join(installPath,"node_modules",this.name);
			let info=this.npmRepo.getPackageInfoSync(this.name);
			//console.log(info.versions[this.version]);

			entries.push({
				name: this.name,
				path: installPath,
				version: this.version,
				tarball: info.versions[this.version].dist.tarball
			});
		}

		for (let dependency of this.dependencies)
			entries.push(...await dependency.getLockFile(installPath));

		return entries;
	}

	logTree(indentation) {
		if (!indentation)
			indentation=0;

		console.log("* "+" ".repeat(indentation)+this.name+" "+this.versionSpec+" => "+this.version);
		for (let dependency of this.dependencies)
			dependency.logTree(indentation+1);
	}
}