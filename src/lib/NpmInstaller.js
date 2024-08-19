import NpmRepo from "./NpmRepo.js";
import NpmDependency from "./NpmDependency.js";
import path from "path-browserify";

export default class NpmInstaller {
	constructor({cwd, registryUrl, fetch, infoDir, fs, rewriteTarballUrl, casDir}) {
		this.cwd=cwd;
		this.fs=fs;
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

	async run() {
		await this.loadDependencies();

		for (let dependency of this.getAllDependencies())
			await dependency.install();
	}

	getInstallPath() {
		return this.cwd;
	}
}