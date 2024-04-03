import {TarReader} from '@gera2ld/tarjs';

let infoResponse=await fetch("https://registry.npmjs.org/preact");
let info=await infoResponse.json();

let tarballUrl=info.versions["10.20.1"].dist.tarball;
console.log("tarballUrl: "+tarballUrl);

async function fetchTarReader(url) {
	let response=await fetch(url);
	let pipe=response.body.pipeThrough(new DecompressionStream("gzip"));
	let blob=await new Response(pipe).blob();
	return TarReader.load(blob);
}

/*const fetchSampleBlob = () => fetch(tarballUrl);
const fetchStreamToDecompressionStream = (response) => response.body.pipeThrough(new DecompressionStream("gzip"));
const decompressionStreamToBlob = (decompressedStream) => new Response(decompressedStream).blob();
const blobToDir = (blob) => TarReader.load(blob)

fetchSampleBlob()
  .then(fetchStreamToDecompressionStream)
  .then(decompressionStreamToBlob)
  .then(blobToDir)
  .then(console.log); // you should see a few files from the downloaded git repo tarball
*/

let tarReader=await fetchTarReader(tarballUrl);
let blob=tarReader.getFileBlob("package/package.json");
let buf=(await blob.arrayBuffer());
let dec=new TextDecoder("utf8");
console.log(dec.decode(buf));
//console.log(tarReader);