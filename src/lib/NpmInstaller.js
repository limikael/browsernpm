import NpmRepo from "./NpmRepo.js";
import NpmDependency from "./NpmDependency.js";
import path from "path-browserify";
import semver from "semver";

export default class NpmInstaller {
	constructor({cwd, registryUrl, fetch, infoDir, fs, rewriteTarballUrl, casDir, dedupe}) {
		this.cwd=cwd;
		this.fs=fs;
		this.dedupe=dedupe;
		if (this.dedupe===undefined)
			this.dedupe=true;

		this.npmRepo=new NpmRepo({
			registryUrl, 
			fetch, 
			infoDir, 
			fs,
			rewriteTarballUrl, 
			casDir
		});
		this.warnings=[];
	}

	async run() {
		await this.loadDependencies();

		if (this.dedupe) {
			for (let name of this.getAllDependencyNames()) {
				let dep=this.findHoistableDependency(name);
				dep.hoist();
			}
		}

		for (let dependency of this.getAllDependencies())
			await dependency.install();
	}

	async createDependency(name, versionSpec) {
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
			let dep=await this.createDependency(depName,deps[depName]);
			this.addDependency(dep);
			await dep.loadDependencies();
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
					semver.satisfies(version,dep.versionSpec))
				count++;

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

		return resVersion;
	}

	findHoistableDependency(name) {
		return this.getVersionDependency(name,this.findHoistableVersion(name));
	}

	getCompatibleDependencies(name, version) {
		let compatible=[];
		for (let dep of this.getAllDependencies())
			if (dep.name==name &&
					semver.satisfies(version,dep.versionSpec))
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