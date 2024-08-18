import path from "path";
import {fileURLToPath} from 'url';
import {createDebugFetch} from "../src/utils/debug-util.js";
import {fetchTarReader, extractTar} from "../src/utils/tar-util.js";
import fs from "fs";
import {exists} from "../src/utils/fs-util.js";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("tar-util",()=>{
	/*it("can fetch a tar reader online",async ()=>{
		let tarUrl="https://registry.npmjs.org/katnip/-/katnip-3.0.25.tgz";
		let tarReader=await fetchTarReader(tarUrl);
		console.log(tarReader.fileInfos);
	});*/

	it("can fetch a tar reader",async ()=>{
		let fetch=createDebugFetch();
		let tarUrl="file://"+path.join(__dirname,"data/tar-util/katnip-3.0.25.tgz");
		let tarReader=await fetchTarReader(tarUrl,{fetch});
		expect(tarReader.fileInfos.length).toEqual(30);
	});

	it("can extract a tar",async ()=>{
		let installTo=path.join(__dirname,"/../tmp/katnip-tar-test");
		await fs.promises.rm(installTo,{recursive: true, force: true});

		let fetch=createDebugFetch();
		let tarUrl="file://"+path.join(__dirname,"data/tar-util/katnip-3.0.25.tgz");
		let tarReader=await fetchTarReader(tarUrl,{fetch});
		await extractTar({
			tarReader: tarReader,
			target: installTo,
			archiveRoot: "package",
			fs: fs
		});
		expect(await exists(path.join(installTo,"package.json"),{fs})).toEqual(true);
	});
});
