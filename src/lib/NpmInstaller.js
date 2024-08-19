import NpmRepo from "./NpmRepo.js";
import NpmDependency from "./NpmDependency.js";
import path from "path-browserify";
import semver from "semver";
import {semverNiceSatisfies, getInstalledPackagePaths} from "../utils/npm-util.js";
import {arrayDiff} from "../utils/js-util.js";

export default class NpmInstaller {
	constructor({cwd, registryUrl, fetch, infoDir, fs, casDir, dedupe, ignore, full, clean}) {
		this.cwd=cwd;
		this.fs=fs;
		this.dedupe=dedupe;
		this.ignore=ignore;
		this.full=full;
		this.clean=clean;

		if (this.dedupe===undefined)
			this.dedupe=true;

		if (!this.ignore)
			this.ignore=[];

		if (this.clean===undefined)
			this.clean=true;

		this.npmRepo=new NpmRepo({
			registryUrl, 
			fetch, 
			infoDir, 
			fs,
			casDir
		});
		this.warnings=[];
	}

	async run() {
		let res={success: true};

		await this.loadDependencies();

		if (this.dedupe) {
			for (let name of this.getAllDependencyNames()) {
				let dep=this.findHoistableDependency(name);
				dep.hoist();
			}
		}

		for (let dependency of this.getAllDependencies()) {
			if (this.full ||
					!await dependency.isInstalled())
				await dependency.install();
		}

		if (this.clean)
			res.removed=await this.cleanUp();

		res.warnings=[...this.warnings];
		return res;
	}

	async cleanUp() {
		let existing=await getInstalledPackagePaths(this.cwd,{fs:this.fs});
		let expected=this.getAllDependencies().map(d=>d.getInstallPath());

		let missing=arrayDiff(expected,existing);
		if (missing.length)
			throw new Error("Missing after install: "+missing);

		let extras=arrayDiff(existing,expected);
		for (let extra of extras)
			await this.fs.promises.rm(extra,{recursive: true, force: true});

		return extras.length;
	}

	async createDependency(name, versionSpec) {
		if (this.ignore.includes(name))
			throw new Error("Trying to create ignored dep: "+name);

		let dependency=new NpmDependency({
			npmInstaller: this,
			name,
			versionSpec,
		});

		await dependency.init();
		return dependency;
	}

	async loadDependencies() {
		this.dependencies=[];

		let pkgPath=path.join(this.cwd,"package.json");
		let pkgText=await this.fs.promises.readFile(pkgPath,"utf8");
		let pkg=JSON.parse(pkgText);
		let deps=pkg.dependencies;
		if (!deps)
			deps={};

		for (let depName in deps) {
			if (!this.ignore.includes(depName)) {
				let dep=await this.createDependency(depName,deps[depName]);
				this.addDependency(dep);
				await dep.loadDependencies();
			}
		}
	}

	addDependency(dependency) {
		dependency.setParent(this);
	}

	getAllDependencies() {
		let allDeps=[];
		for (let dep of this.dependencies)
			allDeps.push(...dep.getAllDependencies())

		return allDeps;
	}

	getAllDependencyNames() {
		let names=[];
		for (let dep of this.getAllDependencies())
			if (!names.includes(dep.name))
				names.push(dep.name);

		return names;
	}

	getInstallPath() {
		return this.cwd;
	}

	getTree() {
		return {
			dependencies: this.dependencies.map(d=>d.getTree())
		}
	}

	getSatisfiesCount(name, version) {
		let count=0;

		for (let dep of this.getAllDependencies())
			if (dep.name==name &&
					semverNiceSatisfies(version,dep.versionSpec))
				count++;

		if (!count)
			throw new Error("count is 0 for: "+name+" "+version);

		return count;
	}

	getDependencyVersions(name) {
		let versions=[];

		for (let dep of this.getAllDependencies())
			if (dep.name==name &&
					!versions.includes(dep.resolvedVersion))
				versions.push(dep.resolvedVersion);

		return versions;
	}

	findHoistableVersion(name) {
		let maxCount=0;
		let resVersion;

		for (let version of this.getDependencyVersions(name)) {
			let count=this.getSatisfiesCount(name,version);
			if (count>maxCount) {
				maxCount=count;
				resVersion=version
			}
		}		

		if (!resVersion)
			throw new Error("Unable to find hoistable version for: "+name);

		return resVersion;
	}

	findHoistableDependency(name) {
		return this.getVersionDependency(name,this.findHoistableVersion(name));
	}

	getCompatibleDependencies(name, version) {
		let compatible=[];
		for (let dep of this.getAllDependencies())
			if (dep.name==name &&
					semverNiceSatisfies(version,dep.versionSpec))
				compatible.push(dep);

		return compatible;
	}

	getVersionDependency(name, version) {
		for (let dep of this.getAllDependencies())
			if (dep.name==name &&
					dep.resolvedVersion==version)
				return dep;
	}
}