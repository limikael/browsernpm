import semver from "semver";
import urlJoin from "url-join";
import {TarReader, TarFileType} from '@gera2ld/tarjs';

function semverIntersectsAll(all, range) {
	for (let allRange of all)
		if (!semver.intersects(allRange,range))
			return false;

	return true;
}

export function semverComputeSets(ranges) {
	let sets=[];

	for (let range of ranges) {
		let useSet=null;
		for (let set of sets)
			if (semverIntersectsAll(set,range))
				useSet=set;

		if (!useSet) {
			useSet=[];
			sets.push(useSet);
		}

		useSet.push(range);
	}

	return sets;
}

export function semverMaxSatisfyingAll(available, ranges) {
	let cands=[];
	for (let range of ranges)
		cands.push(semver.maxSatisfying(available,range));

	cands.sort(semver.compare);
	return cands[0];
}

export async function fetchPackageInfo(packageName) {
	let response=await fetch(urlJoin("https://registry.npmjs.org/",packageName));
	if (response.status<200 || response.status>=300)
		throw new Error("Can't get package info: "+response.status);

	return await response.json();
}

export async function downloadPackage({url, cwd, fsPromises, path}) {
	async function fetchTarReader(tarUrl) {
		let response=await fetch(tarUrl);
		let pipe=response.body.pipeThrough(new DecompressionStream("gzip"));
		let blob=await new Response(pipe).blob();
		return TarReader.load(blob);
	}

	let tarReader=await fetchTarReader(url);
	for (let fileInfo of tarReader.fileInfos) {
		let relFn=path.relative(path.join("/","package"),path.join("/",fileInfo.name));

		if (relFn && fileInfo.type!=TarFileType.Dir) {
			//console.log("processing: "+relFn+" type: "+fileInfo.type);
			let fn=path.join(cwd,relFn);
			let dirname=path.dirname(fn);
			await fsPromises.mkdir(dirname,{recursive: true});
			let blob=tarReader.getFileBlob(fileInfo.name);
			let array=new Uint8Array(await blob.arrayBuffer());
			await fsPromises.writeFile(fn,array);
		}
	}
}
