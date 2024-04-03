	/*getSatisfiedVersion() {
		let versions=Object.keys(this.info.versions);
		versions.sort((a,b)=>{
			if (semver.lt(a,b))
				return 1;

			if (semver.gt(a,b))
				return -1;

			return 0;
		});

		for (let versionCand of versions) {
			let satisfied=true;
			for (let spec of this.versionSpecs)
				if (!semver.satisfies(versionCand,spec))
					satisfied=false;

			if (satisfied)
				return versionCand;
		}

		throw new Error("Can't be satisfied "+this.name+" "+this.versionSpecs.join(" "));
	}*/


		//console.log("using ",);

		/*let useVersion=dependency.getSatisfiedVersion();
		let dependencies=dependency.info.versions[useVersion].dependencies;

		if (!dependencies)
			return;

		for (let k in dependencies)
			await this.addDependency(k,dependencies[k]);*/
