export {downloadPackage} from "./npm-util.js";
import {exists,mkdirRecursive} from "./fs-util.js";
import NpmRepo from "./NpmRepo.js";
import NpmPackage from "./NpmPackage.js";
import {runInParallel} from "./js-util.js";
import path from "path-browserify";
import {downloadPackage} from "./npm-util.js";

//export let downloadPackage=downloadPackage;

export async function resolveDependencies({dependencies, fsPromises, infoCache, onProgress}) {
	let npmRepo=new NpmRepo({
		fsPromises: fsPromises,
		infoCache: infoCache
	});

	let npmPackage=new NpmPackage({
		npmRepo: npmRepo,
		name: "#root",
		versionSpec: "root"
	});

	if (onProgress) {
		npmPackage.addEventListener("dependencyAdded",()=>{
			onProgress(npmPackage.getLoadCompletion());
		});
	}

	await npmPackage.addDependencies(dependencies);

	npmPackage.dedupe();

	return {
		success: true,
		packages: await npmPackage.getLockFile(),
		warnings: npmPackage.warnings
	}
}

export async function installDependencies({cwd, fsPromises, infoCache, onProgress}) {
	let pkgText=await fsPromises.readFile(path.join(cwd,"package.json"),"utf8");
	let pkg=JSON.parse(pkgText);
	if (!onProgress)
		onProgress=()=>{};

	let incompleteFile=path.join(cwd,"node_modules",".INCOMPLETE");
	if (!await exists(fsPromises,path.dirname(incompleteFile)))
		await mkdirRecursive(fsPromises,path.dirname(incompleteFile))

	await fsPromises.writeFile(incompleteFile,"");

	let resolveResult=await resolveDependencies({
		fsPromises,
		dependencies: pkg.dependencies,
		infoCache,
		onProgress: p=>onProgress("info",p)
	});

	let packages=resolveResult.packages;
	let procs=[];
	for (let pkg of resolveResult.packages) {
		procs.push(async ()=>{
			//console.log("download: "+pkg.name+" to: "+path.join(cwd,pkg.path));
			await downloadPackage({
				fsPromises,
				url: pkg.tarball,
				cwd: path.join(cwd,pkg.path)
			});
		});
	}

	await runInParallel(procs,4,p=>onProgress("install",p));
	if (await exists(fsPromises,incompleteFile))
		await fsPromises.unlink(incompleteFile);

	return {
		success: true,
		warnings: resolveResult.warnings
	}
}