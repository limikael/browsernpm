import path from "path-browserify";

export default class NpmDependency {
	constructor({npmInstaller, name, versionSpec}) {
		this.npmInstaller=npmInstaller;
		this.npmRepo=npmInstaller.npmRepo;
		this.name=name;
		this.versionSpec=versionSpec;
	}

	async init() {
		this.dependencies=[];
		this.resolvedVersion=await this.npmRepo.getSatisfyingVersion(this.name,this.versionSpec);
		let dependencySpecs=await this.npmRepo.getVersionDependencies(this.name,this.resolvedVersion);
		for (let depName of Object.keys(dependencySpecs))
			this.addDependency(await this.npmInstaller.createDependency(depName,dependencySpecs[depName]));
	}

	addDependency(dependency) {
		dependency.parent=this;
		this.dependencies.push(dependency);
	}

	getTree() {
		return {
			name: this.name,
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
		if (this.parent)
			return path.join(this.parent.getInstallPath(),"node_modules",this.name);

		else
			return path.join(this.npmInstaller.cwd,"node_modules",this.name);
	}

	async install() {
		await this.npmInstaller.npmRepo.install(
			this.name,
			this.resolvedVersion,
			this.getInstallPath()
		);
	}
}