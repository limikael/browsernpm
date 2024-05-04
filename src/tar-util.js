import {TarReader, TarFileType} from '@gera2ld/tarjs';
import {minimatch} from "minimatch";

export async function fetchTarReader(tarUrl) {
	let response=await fetch(tarUrl);
	let pipe=response.body.pipeThrough(new DecompressionStream("gzip"));
	let blob=await new Response(pipe).blob();
	return TarReader.load(blob);
}

export function tarReaderMatch(tarReader, pattern) {
	for (let fileInfo of tarReader.fileInfos) {
		if (minimatch(fileInfo.name,pattern))
			return fileInfo.name;
	}
}