import semver from "semver";

export class PackageSpec {
	constructor(name, versionSpec) {
		this.name=name;
		this.versionSpec=versionSpec;
	}

	async addDependencies() {
		let info=await this.packageSpecs.npmRepo.getPackageInfo(this.name);
		let matchedVersion=semver.maxSatisfying(Object.keys(info.versions),this.versionSpec);
		let dependencies=info.versions[matchedVersion].dependencies;
		for (let k in dependencies) {
			let packageSpec=new PackageSpec(k,dependencies[k]);
			await this.packageSpecs.addSpec(packageSpec);
		}
	}
}

export class PackageSpecs {
	constructor({npmRepo}) {
		this.npmRepo=npmRepo;
		this.specs=[];
	}

	hasSpec(spec) {
		for (let specCand of this.specs)
			if (spec.name==specCand.name &&
					spec.versionSpec==specCand.versionSpec)
				return true;
	}

	async addSpec(spec) {
		if (this.hasSpec(spec))
			return;

		console.log("adding: "+spec.name+" "+spec.versionSpec);

		spec.packageSpecs=this;
		this.specs.push(spec);

		await spec.addDependencies();
	}
}