import {TarReader, TarFileType} from '@gera2ld/tarjs';
import {minimatch} from "minimatch";
import path from "path-browserify";

export async function fetchTarReader(tarUrl, {fetch, onProgress}={}) {
	if (!fetch)
		fetch=globalThis.fetch.bind(globalThis);

	//console.log("fetching tarUrl: "+tarUrl);
	let response=await fetch(tarUrl);
	let contentLength=Number(response.headers.get("content-length"));
	let progressTotal=0;
	var progress=new TransformStream({
		transform(chunk, controller) {
			progressTotal+=chunk.length;
			if (contentLength && !isNaN(contentLength)) {
				let percent=Math.round(100*progressTotal/contentLength);
				if (onProgress)
					onProgress(percent);
			}

			controller.enqueue(chunk);
		}
	});

	let pipe=response.body.pipeThrough(progress).pipeThrough(new DecompressionStream("gzip"));
	let blob=await new Response(pipe).blob();
	return await TarReader.load(blob);
}

export function tarReaderMatch(tarReader, pattern) {
	for (let fileInfo of tarReader.fileInfos) {
		if (minimatch(fileInfo.name,pattern))
			return fileInfo.name;
	}
}

export async function extractTar({tarReader, target, fs, archiveRoot, writeBlob, 
		fetch, url, throttle, onProgress}={}) {
	if (url) {
		tarReader=await fetchTarReader(url,{fetch, onProgress: percent=>{
			if (onProgress)
				onProgress("download", percent);
		}});
	}

	if (!archiveRoot)
		archiveRoot="";

	if (onProgress)
		onProgress("extract",0);

	let count=0, index=0;
	let reportedPercent=0;
	for (let fileInfo of tarReader.fileInfos) {
		let relFn=path.relative(path.join("/",archiveRoot),path.join("/",fileInfo.name));
		if (relFn && !relFn.startsWith("..") && fileInfo.type!=TarFileType.Dir) {
			//console.log(relFn);

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

			count++;
			if (throttle && !(count%throttle))
				await new Promise(r=>setTimeout(r,0));
		}

		index++;
		let percent=Math.round(100*index/tarReader.fileInfos.length);
		if (percent!=reportedPercent && onProgress)
		if (onProgress)
			onProgress("extract",percent);

		reportedPercent=percent;
	}
}