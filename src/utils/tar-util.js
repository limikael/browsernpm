import {TarReader, TarFileType} from '@gera2ld/tarjs';
import {minimatch} from "minimatch";
import path from "path-browserify";

export async function fetchTarReader(tarUrl, {fetch}={}) {
	if (!fetch)
		fetch=globalThis.fetch.bind(globalThis);

	let response=await fetch(tarUrl);
	let pipe=response.body.pipeThrough(new DecompressionStream("gzip"));
	let blob=await new Response(pipe).blob();
	return await TarReader.load(blob);
}

export function tarReaderMatch(tarReader, pattern) {
	for (let fileInfo of tarReader.fileInfos) {
		if (minimatch(fileInfo.name,pattern))
			return fileInfo.name;
	}
}

export async function extractTar({tarReader, target, fs, archiveRoot, writeBlob, fetch, url}={}) {
	if (url)
		tarReader=await fetchTarReader(url,{fetch});

	if (!archiveRoot)
		archiveRoot="";

	for (let fileInfo of tarReader.fileInfos) {
		let relFn=path.relative(path.join("/",archiveRoot),path.join("/",fileInfo.name));
		//console.log(relFn);

		if (relFn && fileInfo.type!=TarFileType.Dir) {
			//console.log("processing: "+relFn+" type: "+fileInfo.type);
			let fn=path.join(target,relFn);
			//console.log(fn);
			let dirname=path.dirname(fn);
			await fs.promises.mkdir(dirname,{recursive: true});
			let blob=tarReader.getFileBlob(fileInfo.name);

			if (writeBlob)
				fs.promises.writeFile(fn,blob);

			else {
				let array=new Uint8Array(await blob.arrayBuffer());
				await fs.promises.writeFile(fn,array);
			}
		}
	}
}