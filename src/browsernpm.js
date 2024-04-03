import NpmRepo from "./NpmRepo.js";
import NpmPackage from "./NpmPackage.js";
import {downloadPackage} from "./npm-util.js";
import {runInParallel} from "./js-util.js";

export async function resolveDependencies({dependencies, fsPromises, path, infoCache, onProgress}) {
	let npmRepo=new NpmRepo({
		fsPromises: fsPromises,
		path: path,
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

export async function installDependencies({cwd, fsPromises, path, infoCache, onProgress}) {
	let pkgText=await fsPromises.readFile(path.join(cwd,"package.json"),"utf8");
	let pkg=JSON.parse(pkgText);
	if (!onProgress)
		onProgress=()=>{};

	let resolveResult=await resolveDependencies({
		fsPromises,
		path,
		dependencies: pkg.dependencies,
		//infoCache,
		onProgress: p=>onProgress("info",p)
	});

	let packages=resolveResult.packages;
	let procs=[];
	for (let pkg of resolveResult.packages) {
		procs.push(async ()=>{
			//console.log("download: "+pkg.name+" to: "+path.join(cwd,pkg.path));
			await downloadPackage({
				fsPromises,
				path,
				url: pkg.tarball,
				cwd: path.join(cwd,pkg.path)
			});
		});
	}

	await runInParallel(procs,4,p=>onProgress("install",p));

	return {
		success: true,
		warnings: resolveResult.warnings
	}
}