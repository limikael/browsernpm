import {fetchPackageInfo} from "./npm-util.js";
import {exists} from "./fs-util.js";
import {ResolvablePromise} from "./js-util.js";

export default class NpmRepo {
	constructor({infoCache, fsPromises, path}) {
		this.fsPromises=fsPromises;
		this.infoCache=infoCache;
		this.path=path;
		this.packageInfoByName={};
		this.syncPackageInfoByName={};
	}

	async getPackageInfo(packageName) {
		if (this.packageInfoByName[packageName])
			return await this.packageInfoByName[packageName];

		let promise=new ResolvablePromise();
		this.packageInfoByName[packageName]=promise;

		if (this.infoCache) {
			let infoJsonPath=this.path.join(this.infoCache,packageName+".json");
			if (await exists(this.fsPromises,infoJsonPath)) {
				//console.log("loading...");
				promise.resolve(JSON.parse(
					await this.fsPromises.readFile(infoJsonPath,"utf8")
				));
			}

			else {
				//console.log("fetching and saving...");
				let info=await fetchPackageInfo(packageName);

				await this.fsPromises.mkdir(this.path.dirname(infoJsonPath),{recursive: true});
				await this.fsPromises.writeFile(infoJsonPath,JSON.stringify(info));

				promise.resolve(info);
			}
		}

		else {
			//console.log("fetching...");
			promise.resolve(await fetchPackageInfo(packageName));
		}

		let info=await promise;
		this.syncPackageInfoByName[packageName]=info;

		return info;
	}

	getPackageInfoSync(packageName) {
		if (!this.syncPackageInfoByName[packageName])
			throw new Error("Package not available: "+packageName);

		return this.syncPackageInfoByName[packageName];
	}
}