import NpmRepo from "./NpmRepo.js";
import NpmDependency from "./NpmDependency.js";
import path from "path-browserify";
import semver from "semver";
import {semverNiceSatisfies, getInstalledPackagePaths, projectNeedInstall} from "../utils/npm-util.js";
import {arrayDiff, runInParallel, isValidUrl} from "../utils/js-util.js";
import {exists} from "../utils/fs-util.js";

export default class NpmInstaller {
	constructor({cwd, registryUrl, fetch, infoDir, fs, casDir, dedupe, 
			ignore, full, clean, override, quick, onProgress, writeBlob}) {
		this.cwd=cwd;
		this.fs=fs;
		this.dedupe=dedupe;
		this.ignore=ignore;
		this.full=full;
		this.clean=clean;
		this.onProgress=onProgress;
		this.override=override;
		this.quick=quick;

		if (this.dedupe===undefined)
			this.dedupe=true;

		if (!this.ignore)
			this.ignore=[];

		if (this.clean===undefined)
			this.clean=true;

		if (!this.override)
			this.override={};

		this.npmRepo=new NpmRepo({
			registryUrl,
			fetch,
			infoDir,
			fs,
			casDir,
			casOverride: Object.keys(this.override),
			writeBlob
		});
		this.warnings=[];
	}

	async run() {
		//console.log("RUNNING NEW INSTALLER...");

		let res={success: true};

		let incompleteFile=path.join(this.cwd,"node_modules",".INCOMPLETE");
		if (await exists(incompleteFile,{fs:this.fs})) {
			//console.log("incomplete exists");
			this.full=true;
		}

		let overrideFile=path.join(this.cwd,"node_modules",".OVERRIDE");
		if (await exists(overrideFile,{fs:this.fs}) ||
				Object.keys(this.override).length)
			this.quick=false;

		if (this.quick
				&& (Object.keys(this.override).length==0)
				&& !this.full
				&& !Object.keys(this.override).length
				&& !await projectNeedInstall(this.cwd,{fs: this.fs, ignore: this.ignore})) {
			let res={success: true, quick: true, warnings: []};

			// will not work.
			/*if (this.clean)
				res.removed=await this.cleanUp();*/

			//console.log("returning.....");
			return res;
		}

		if (!await exists(path.dirname(incompleteFile),{fs:this.fs}))
			await this.fs.promises.mkdir(path.dirname(incompleteFile),{resursive:true});

		await this.fs.promises.writeFile(incompleteFile,"");
		if (Object.keys(this.override).length)
			await this.fs.promises.writeFile(overrideFile,"");

		await this.loadDependencies();

		if (this.dedupe) {
			for (let name of this.getAllDependencyNames()) {
				let dep=this.findHoistableDependency(name);
				dep.hoist();
			}
		}

		let jobs=[];
//		for (let dependency of this.getAllDependencies()) {
		for (let dependency of this.dependencies) {
			jobs.push(async ()=>{
				if (this.full ||
						!await dependency.isInstalled()) {
					await dependency.install();
					await new Promise(r=>setTimeout(r,0));
				}
			});
		}

		//console.log("job len: "+jobs.length);

		if (jobs.length && this.onProgress)
			this.onProgress("install",0);

		let oldReported=-1;
		await runInParallel(jobs,10,progress=>{
			if (this.onProgress && progress>oldReported) {
				oldReported=progress;
				this.onProgress("install",progress);
			}
		});

		if (this.clean)
			res.removed=await this.cleanUp();

		await this.fs.promises.unlink(incompleteFile);
		if (await exists(overrideFile,{fs:this.fs}) &&
				!Object.keys(this.override).length)
			await this.fs.promises.unlink(overrideFile);

		//console.log("install done");

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
		//console.log(extras);
		for (let extra of extras)
			await this.fs.promises.rm(extra,{recursive: true, force: true});

		return extras.length;
	}

	async createDependency(name, versionSpec) {
		if (this.ignore.includes(name))
			throw new Error("Trying to create ignored dep: "+name);

		/*if (name=="katnip-components")
			console.log("create dep: ",this.override);*/

		if (this.override[name])
			versionSpec=this.override[name];

		let dependency=new NpmDependency({
			npmInstaller: this,
			name,
			versionSpec,
		});

		await dependency.init();
		return dependency;
	}

	shouldIgnore(depName, version) {
		if (this.ignore.includes(depName))
			return true;

		if (isValidUrl(version)) {
			let u=new URL(version);
			switch (u.protocol) {
				case "http:":
				case "https:":
					break;

				case "npm:":
					this.warnings.push("Can't handle npm: deps: "+depName+" "+version);
					return true;
					break;

				default:
					throw new Error("Unknown url dep: "+version);
					break;
			}
		}

		return false;
	}

	async loadDependencies() {
		this.dependencies=[];

		let pkgPath=path.join(this.cwd,"package.json");
		let pkgText=await this.fs.promises.readFile(pkgPath,"utf8");
		let pkg=JSON.parse(pkgText);
		let deps=pkg.dependencies;
		if (!deps)
			deps={};

		/*let depPromises=[];
		for (let depName in deps) {
			if (!this.shouldIgnore(depName,deps[depName])) {
				depPromises.push(this.createDependency(depName,deps[depName]))
			}
		}

		for (let dep of await Promise.all(depPromises))
			this.addDependency(dep);*/

		let addPromises=[];
		for (let depName in deps) {
			if (!this.shouldIgnore(depName,deps[depName])) {
				addPromises.push((async ()=>{
					let dep=await this.createDependency(depName,deps[depName]);
					this.addDependency(dep);
				})());
			}
		}

		await Promise.all(addPromises);

		let oldReported=-1;
		let handleProgress=()=>{
			//console.log("handle load progress: "+this.getLoadDependenciesPercent());
			let percent=this.getLoadDependenciesPercent();
			if (this.onProgress && (percent>oldReported)) {
				this.onProgress("info",percent);
				oldReported=percent;
			}
		}

		let loadPromises=[];
		for (let dep of this.dependencies)
			loadPromises.push(dep.loadDependencies({onProgress: handleProgress}));

		await Promise.all(loadPromises);

		handleProgress();
	}

	getLoadDependenciesPercent() {
		if (!this.dependencies.length)
			return 100;

		let totalPercent=0;
		for (let dep of this.dependencies)
			totalPercent+=dep.getLoadDependenciesPercent();

		return Math.round(totalPercent/this.dependencies.length);
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