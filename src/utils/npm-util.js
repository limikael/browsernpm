import semver from "semver";
import urlJoin from "url-join";
import {TarReader, TarFileType} from '@gera2ld/tarjs';
import path from "path-browserify";
import {exists} from "./fs-util.js";
import {arrayUnique, isValidUrl} from "./js-util.js";

export function semverNiceSatisfies(version, range) {
	//console.log("sat: "+version+" "+range);
	if (isValidUrl(version) && version==range)
		return true;

	return semver.satisfies(version,range);
}

export function semverNiceMax(cands) {
	let validCands=cands.filter(cand=>semver.valid(cand));
	if (validCands.length) {
		validCands.sort(semver.rcompare);
		return validCands[0];
	}

	return cands[0];
}

function semverIntersectsAll(all, range) {
	for (let allRange of all)
		if (!semver.intersects(allRange,range))
			return false;

	return true;
}

export function semverComputeSets(ranges) {
	let sets=[];
	let urls=[];

	for (let range of ranges) {
		let useSet=null;
		if (semver.validRange(range)) {
			for (let set of sets)
				if (semverIntersectsAll(set,range))
					useSet=set;

			if (!useSet) {
				useSet=[];
				sets.push(useSet);
			}

			useSet.push(range);
		}

		else {
			if (!urls.includes(range))
				urls.push(range);
		}
	}

	for (let i=0; i<sets.length; i++)
		sets[i]=arrayUnique(sets[i]);

	sets.push(...urls.map(a=>[a]));

	return sets;
}

export function semverMaxSatisfyingAll(available, ranges) {
	if (!semver.validRange(ranges[0])) {
		if (ranges.length!=1)
			throw new Error("Didn't expect several urls in set: "+ranges);

		return ranges[0];
	}

	let cands=[];
	for (let range of ranges)
		cands.push(semver.maxSatisfying(available,range));

	cands.sort(semver.compare);
	return cands[0];
}

/*export async function fetchPackageInfo(packageName) {
	let response=await fetch(urlJoin("https://registry.npmjs.org/",packageName));
	if (response.status<200 || response.status>=300)
		throw new Error("Can't get package info: "+response.status);

	return await response.json();
}*/

export async function projectNeedInstall(projectDir, {fs, ignore}) {
	/*if (!path.isAbsolute(projectDir))
		throw new Error("Need absolute project path");*/

	if (!ignore)
		ignore=[];

	if (await exists(path.join(projectDir,"node_modules",".INCOMPLETE"),{fs}))
		return true;

	let mainPackageJsonPath=path.join(projectDir,"package.json");
	let mainPackageText=await fs.promises.readFile(mainPackageJsonPath,"utf8");
	//console.log(mainPackageText);
	let mainPackageJson=JSON.parse(mainPackageText);
	for (let depName in mainPackageJson.dependencies) {
		if (!ignore.includes(depName)) {
			let depPackageJsonPath=path.join(projectDir,"node_modules",depName,"package.json");
			if (!(await exists(depPackageJsonPath,{fs})))
				return true;

			let depPackageJson=JSON.parse(await fs.promises.readFile(depPackageJsonPath,"utf8"));
			let currentVersion=depPackageJson.version;
			let requiredVersion=mainPackageJson.dependencies[depName];

			//console.log("checking: "+depName+" "+currentVersion+" "+requiredVersion);

			if (!semver.satisfies(currentVersion,requiredVersion))
				return true;
		}
	}

	return false;
}

/*export async function downloadPackage({url, cwd, fsPromises}) {
	let tarReader=await fetchTarReader(url);
	for (let fileInfo of tarReader.fileInfos) {
		let relFn=path.relative(path.join("/","package"),path.join("/",fileInfo.name));

		if (relFn && fileInfo.type!=TarFileType.Dir) {
			//console.log("processing: "+relFn+" type: "+fileInfo.type);
			let fn=path.join(cwd,relFn);
			let dirname=path.dirname(fn);
			await mkdirRecursive(fsPromises,dirname);
			let blob=tarReader.getFileBlob(fileInfo.name);
			let array=new Uint8Array(await blob.arrayBuffer());
			await fsPromises.writeFile(fn,array);
		}
	}
}*/

export async function getInstalledPackagePaths(root, {fs}) {
	if (!await exists(root,{fs}))
		throw new Error("Does not exist: "+root);

	let modulesDir=path.join(root,"node_modules");
	if (!await exists(modulesDir,{fs}))
		return [];

	let res=[];
	let pathnames=await fs.promises.readdir(modulesDir);
	for (let pathname of pathnames) {
		if (!pathname.startsWith(".")) {
			let subpath=path.join(root,"node_modules",pathname);
			if (pathname.startsWith("@")) {
				let subpathnames=await fs.promises.readdir(subpath);
				for (let subpathname of subpathnames) {
					if (!subpathname.startsWith(".")) {
						let subsub=path.join(subpath,subpathname)
						res.push(subsub);
						res.push(...await getInstalledPackagePaths(subsub,{fs}));
					}
				}
			}

			else {
				res.push(subpath);
				res.push(...await getInstalledPackagePaths(subpath,{fs}));
			}
		}
	}

	return res;
}