import NpmRepo from "./NpmRepo.js";
import NpmPackage from "./NpmPackage.js";
import path from "path-browserify";
import {runInParallel} from "./js-util.js";
import {exists, mkdirRecursive} from "./fs-util.js";
import {projectNeedInstall} from "./npm-util.js";

/**
 * cwd            - npm project dir
 * override       - {isoq: "https://blabla"} - packages to override
 * infoCache      - info cache dir
 * dependencyKey  - key to use to resolve dependencies
 *
 * keywords       - only install packages with these keywords
 * cleanup        - remove extra packages
 * full           - install even if existing
 * rebuildCache   - don't rely on cache
 * 
 * Url deps are always reinstalled
 */
export default class NpmInstaller {
	constructor({cwd, fs, infoCache, onProgress, full, overrides, dependenciesKey, quick}) {
		this.cwd=cwd;
		this.fs=fs;
		this.npmRepo=new NpmRepo({fs, infoCache});
		this.npmPackage=new NpmPackage({npmInstaller: this});
		this.full=full;
		this.onProgress=onProgress;
		this.overrides=overrides;
		this.dependenciesKey=dependenciesKey;
		this.quick=quick;

		if (!this.onProgress)
			this.onProgress=()=>{};

		if (!this.overrides)
			this.overrides={};
	}

	async run() {
		this.onProgress("info",0);

		let incompleteFile=path.join(this.cwd,"node_modules",".INCOMPLETE");
		if (await exists(incompleteFile,{fs:this.fs}))
			this.full=true;

		if (this.quick
				&& !this.full
				&& !Object.keys(this.overrides).length
				&& !await projectNeedInstall(this.cwd,{fs:this.fs}))
			return;

		//console.log("installing..");

		if (!await exists(path.dirname(incompleteFile),{fs:this.fs}))
			await mkdirRecursive(path.dirname(incompleteFile),{fs:this.fs});

		await this.fs.promises.writeFile(incompleteFile,"");

		let packageJsonPath=path.join(this.cwd,"package.json");
		let packageJsonText=await this.fs.promises.readFile(packageJsonPath,"utf8");
		let packageJson=JSON.parse(packageJsonText);
		this.npmPackage.initPackageJson(packageJson);
		this.npmPackage.addEventListener("dependencyAdded",()=>{
			this.onProgress("info",this.npmPackage.getLoadCompletion());
		});

		await this.npmPackage.loadDependencies();
		this.npmPackage.dedupe();

		this.onProgress("install",0);
		let procs=[];
		for (let pkg of this.npmPackage.getInstallablePackages())
			procs.push(async ()=>{
				if (this.full ||
						!await pkg.isInstalled())
					await pkg.install();
			});

		await runInParallel(procs,4,p=>this.onProgress("install",p));
		await this.fs.promises.unlink(incompleteFile);

		this.warnings=this.npmPackage.warnings;
	}
}