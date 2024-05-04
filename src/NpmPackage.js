import semver from "semver";
import {semverComputeSets, semverMaxSatisfyingAll, semverNiceMax} from "./npm-util.js";
import {arrayRemove, arrayOnlyUnique} from "./js-util.js";
import {mkdirRecursive, exists} from "./fs-util.js";
import {fetchTarReader, tarReaderMatch} from "./tar-util.js";
import path from "path-browserify";
import {TarReader, TarFileType} from '@gera2ld/tarjs';

export default class NpmPackage extends EventTarget {
	constructor({npmInstaller, name, versionSpec}) {
		super();

		this.npmInstaller=npmInstaller;
		this.name=name;
		this.versionSpec=versionSpec;

		this.dependencies=[];
		this.warnings=[];
	}

	isCircular(name) {
		if (this.name==name)
			return true;

		if (!this.parent)
			return false;

		return this.parent.isCircular(name);
	}

	async addDependency(name, versionSpec) {
		if (this.isCircular(name)) {
			this.findRoot().warnings.push("Circular: "+name);
			return;
		}

		if (this.npmInstaller.overrides[name])
			versionSpec=this.npmInstaller.overrides[name];

		//console.log("add: "+name+" @ "+versionSpec);

		let npmPackage=new NpmPackage({
			npmInstaller: this.npmInstaller,
			name: name,
			versionSpec: versionSpec,
		});

		npmPackage.parent=this;
		this.dependencies.push(npmPackage);

		await npmPackage.loadInfo();
		if (npmPackage.invalidMessage) {
			this.findRoot().warnings.push(npmPackage.invalidMessage);
			arrayRemove(this.dependencies,npmPackage);
			return;
		}

		await npmPackage.loadDependencies();
		this.findRoot().dispatchEvent(new Event("dependencyAdded"));
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

	async initPackageJson(packageJson) {
		if (this.name || this.versionSpec)
			throw new Error("Not root");

		this.packageJson=packageJson;
	}

	async loadInfo() {
		if (!this.name || !this.versionSpec)
			throw new Error("Don't have name for this package.");

		if (semver.validRange(this.versionSpec)) {
			let info=await this.npmInstaller.npmRepo.getPackageInfo(this.name);
			let matchedVersion=semver.maxSatisfying(Object.keys(info.versions),this.versionSpec);
			if (!matchedVersion) {
				info=await this.npmInstaller.npmRepo.getPackageInfo(this.name,true);
				matchedVersion=semver.maxSatisfying(Object.keys(info.versions),this.versionSpec);
				if (!matchedVersion)
					throw new Error("No matched version!");
			}

			this.version=matchedVersion;
			this.packageJson=info.versions[this.version];
		}

		else {
			let u=new URL(this.versionSpec);
			switch (u.protocol) {
				case "http:":
				case "https:":
					this.tarReader=await fetchTarReader(this.versionSpec);
					let fn=tarReaderMatch(this.tarReader,"package.json")
					if (!fn)
						fn=tarReaderMatch(this.tarReader,"*/package.json");

					if (!fn)
						throw new Error("Not npm package, package.json not found in: "+this.versionSpec);

					this.packageJson=JSON.parse(this.tarReader.getTextFile(fn));
					this.version=this.versionSpec;
					break;

				case "npm:":
					this.invalidMessage=
						"Dependencies with npm: protocol is curently not supported, so ignored. "+
						this.name+"="+this.versionSpec;
					break;

				default:
					throw new Error("Unknown npm dependency protocol: "+this.name+"="+this.versionSpec);
					break;
			}
		}
	}

	async getTarReader() {
		if (!this.tarReader) {
			let info=this.npmInstaller.npmRepo.getPackageInfoSync(this.name);
			this.tarReader=await fetchTarReader(info.versions[this.version].dist.tarball);
		}

		return this.tarReader;
	}

	async loadDependencies() {
		let dependencies;
		if (this.npmInstaller.dependenciesKey)
			dependencies=this.packageJson[this.npmInstaller.dependenciesKey]

		if (!dependencies)
			dependencies=this.packageJson.dependencies;

		if (!dependencies)
			dependencies={};

		//console.log(dependencies);

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

		// If already at root, use this one.
		for (let dependency of this.dependencies)
			if (dependency.name==packageName)
				return dependency.version;

		let allSpecs=this.findAllVersionSpecs(packageName);
		let versions=this.findAllUsedVersions(packageName);
		let sets=semverComputeSets(allSpecs);
		let max=sets.map(set=>semverMaxSatisfyingAll(versions,set));

		/*if (packageName=="katnip-isoq") console.log(allSpecs);
		if (packageName=="katnip-isoq") console.log(versions);
		if (packageName=="katnip-isoq") console.log(max);*/

		return semverNiceMax(max);
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
		//if (packageName=="katnip-isoq") console.log(version+" "+this.versionSpec);

		if (this.name==packageName && this.versionSpec) {
			if (version==this.versionSpec ||
					semver.satisfies(version,this.versionSpec))
				this.parent.removePackage(this);
		}

		for (let dependency of [...this.dependencies])
			dependency.removeCompatibleVersions(packageName,version);
	}

	hoist(packageName, version) {
		if (!this.isRoot())
			throw new Error("Can only hoist at root");

		/*if (packageName=="katnip-isoq")
			console.log("hoisting: "+packageName);*/

		// why this check if already at root?
		/*for (let dependency of this.dependencies)
			if (dependency.name==packageName)
				return;*/

		let npmPackage=this.findPackage(packageName, version);
		if (!npmPackage)
			throw new Error("Can't find "+packageName+" "+version);

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
			/*if (packageName=="katnip-isoq")
				console.log("will hoist: "+packageName);*/

			let version=this.findHoistableVersion(packageName);
			this.hoist(packageName,version);
		}
	}

	getInstallPath() {
		if (this.isRoot())
			return "";

		return path.join(this.parent.getInstallPath(),"node_modules",this.name);
	}

	getInstallablePackages() {
		let packages=[];
		if (!this.isRoot())
			packages.push(this);

		for (let dependency of this.dependencies)
			packages.push(...dependency.getInstallablePackages())

		return packages;
	}

	logTree(indentation) {
		if (!indentation)
			indentation=0;

		console.log("* "+" ".repeat(indentation)+this.name+" "+this.versionSpec+" => "+this.version);
		for (let dependency of this.dependencies)
			dependency.logTree(indentation+1);
	}

	async isInstalled() {
		let cwd=this.npmInstaller.cwd;
		let fs=this.npmInstaller.fs;

		let packageJsonPath=path.join(cwd,this.getInstallPath(),"package.json");
		if (!await exists(packageJsonPath,{fs}))
			return false;

		let packageJson=JSON.parse(await fs.promises.readFile(packageJsonPath));
		return (packageJson.version==this.version);
	}

	async install() {
		let cwd=this.npmInstaller.cwd;

		//console.log("installing "+this.name+"@"+this.version+" to "+this.getInstallPath());
		let tarReader=await this.getTarReader();
		let fn=tarReaderMatch(tarReader,"package.json")
		if (!fn)
			fn=tarReaderMatch(tarReader,"*/package.json");

		if (!fn)
			throw new Error("Not npm package, package.json not found in: "+this.versionSpec);

		let packageDir=path.dirname(fn);
		//console.log(packageDir);

		for (let fileInfo of tarReader.fileInfos) {
			let relFn=path.relative(path.join("/",packageDir),path.join("/",fileInfo.name));

			//console.log(fileInfo.type);
			if (relFn && fileInfo.type!=TarFileType.Dir && fileInfo.type!=103) {
				//console.log("processing: "+relFn+" type: "+fileInfo.type);
				let fn=path.join(cwd,this.getInstallPath(),relFn);
				let dirname=path.dirname(fn);
				await mkdirRecursive(dirname,{fs:this.npmInstaller.fs});
				let blob=tarReader.getFileBlob(fileInfo.name);
				let array=new Uint8Array(await blob.arrayBuffer());
				await this.npmInstaller.fs.promises.writeFile(fn,array);
			}
		}
	}
}