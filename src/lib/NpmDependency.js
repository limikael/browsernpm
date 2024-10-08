import path from "path-browserify";
import {exists} from "../utils/fs-util.js";

export default class NpmDependency {
	constructor({npmInstaller, name, versionSpec}) {
		this.npmInstaller=npmInstaller;
		this.npmRepo=npmInstaller.npmRepo;
		this.name=name;
		this.versionSpec=versionSpec;
	}

	async init() {
		this.resolvedVersion=await this.npmRepo.getSatisfyingVersion(this.name,this.versionSpec);
		//console.log("resolved: "+this.resolvedVersion);

		this.dependencySpecs=await this.npmRepo.getVersionDependencies(this.name,this.resolvedVersion);
	}

	getDependencyPath() {
		if (!this.parent || this.parent==this.npmInstaller)
			return [this.name];

		return [...this.parent.getDependencyPath(),this.name];
	}

	async loadDependencies({onProgress}) {
		if (this.loadStarted)
			throw new Error("Dependencies already loaded");

		this.loadStarted=true;

		let depPath=this.getDependencyPath();
		//console.log(depPath);
		this.dependencies=[];

		let addPromises=[];
		for (let depName of Object.keys(this.dependencySpecs)) {
			if (depPath.includes(depName)) {
				this.npmInstaller.warnings.push("Circular dependency: "+depName+" in "+this.name);
			}

			else {
				if (!this.npmInstaller.shouldIgnore(depName,this.dependencySpecs[depName])) {
					addPromises.push((async ()=>{
						let dep=await this.npmInstaller.createDependency(depName,this.dependencySpecs[depName]);
						this.addDependency(dep);
					})());
				}
			}
		}

		await Promise.all(addPromises);
		onProgress();

		let loadPromises=[];
		for (let dep of this.dependencies)
			loadPromises.push(dep.loadDependencies({onProgress}));

		await Promise.all(loadPromises);

		onProgress();
	}

	getLoadDependenciesPercent() {
		if (!this.loadStarted)
			return 0;

		//let numDependencies=Object.keys(this.dependencySpecs).length;

		if (!this.dependencies.length)
			return 100;

		let totalPercent=0;
		for (let dep of this.dependencies)
			totalPercent+=dep.getLoadDependenciesPercent();

		return totalPercent/this.dependencies.length;
	}

	addDependency(dependency) {
		dependency.setParent(this);
	}

	setParent(parent) {
		if (this.parent) {
			let index=this.parent.dependencies.indexOf(this);
			if (index<0)
				throw new Error("Not part of parent");

			this.parent.dependencies.splice(index,1);
		}

		this.parent=parent;
		if (this.parent)
			this.parent.dependencies.push(this);
	}

	getTree() {
		return {
			name: this.name+" "+this.versionSpec+" => "+this.resolvedVersion,
			dependencies: this.dependencies.map(d=>d.getTree())
		}
	}

	getAllDependencies() {
		let allDeps=[this];
		for (let dep of this.dependencies)
			allDeps.push(...dep.getAllDependencies())

		return allDeps;
	}

	getInstallPath() {
		if (!this.parent)
			throw new Error("Can't get install path if no parent");

		return path.join(this.parent.getInstallPath(),"node_modules",this.name);
	}

	async install() {
		await this.npmInstaller.npmRepo.install(
			this.name,
			this.resolvedVersion,
			this.getInstallPath()
		);

		for (let dep of this.dependencies)
			await dep.install();
	}

	hoist() {
		this.setParent(null);

		for (let dep of this.npmInstaller.getCompatibleDependencies(this.name,this.resolvedVersion))
			dep.setParent();

		this.setParent(this.npmInstaller);
	}

	async isInstalled() {
		if (Object.keys(this.npmInstaller.override).includes(this.name))
			return false;

		//console.log("is installed? "+this.name);
		let fs=this.npmInstaller.fs;
		if (!await exists(this.getInstallPath(),{fs:fs}) ||
				!await exists(path.join(this.getInstallPath(),"package.json"),{fs:fs}))
			return false;

		let pkgPath=path.join(this.getInstallPath(),"package.json");
		let pkgText=await fs.promises.readFile(pkgPath,"utf8");
		let pkg=JSON.parse(pkgText);
		//console.log(pkg);

		/*if (this.name=="katnip-components") {
			console.log("checking installed: "+this.versionSpec+" res: "+this.resolvedVersion+" current: "+pkg.__installedVersion);
		}*/

		if (pkg.__installedVersion!=this.resolvedVersion)
			return false;

		for (let dep of this.dependencies)
			if (!await dep.isInstalled())
				return false;

		return true;
	}
}