import Cache from "../utils/Cache.js";
import urlJoin from "url-join";
import semver from "semver";
import path from "path-browserify";
import {exists} from "../utils/fs-util.js";
import {extractTar} from "../utils/tar-util.js";

export default class NpmRepo {
	constructor({registryUrl, fetch, infoDir, fs, rewriteTarballUrl}={}) {
		this.registryUrl=registryUrl;
		this.fetch=fetch;
		this.infoDir=infoDir;
		this.fs=fs;
		this.rewriteTarballUrl=rewriteTarballUrl;

		if (!this.registryUrl)
			this.registryUrl="https://registry.npmjs.org/"

		if (!this.fetch)
			this.fetch=globalThis.fetch.bind(globalThis);

		this.infoCache=new Cache({
			getter: key=>this.loadPackageInfo(key),
			invalidator: key=>this.removePackageInfo(key)
		});
	}

	async getSatisfyingVersion(packageName, versionSpec) {
		let packageInfo=await this.infoCache.get(packageName);
		let candVer=semver.maxSatisfying(Object.keys(packageInfo.versions),versionSpec);
		if (candVer)
			return candVer;

		await this.infoCache.invalidate(packageName);
		packageInfo=await this.infoCache.get(packageName);
		candVer=semver.maxSatisfying(Object.keys(packageInfo.versions),versionSpec);
		if (candVer)
			return candVer;

		throw new Error("Not satisfiable: "+packageName+" "+versionSpec);
	}

	async removePackageInfo(packageName) {
		if (this.infoDir) {
			let p=path.join(this.infoDir,packageName);
			await this.fs.promises.rm(p,{force: true});
		}
	}

	async loadPackageInfo(packageName) {
		if (this.infoDir) {
			let p=path.join(this.infoDir,packageName);
			if (await exists(p,{fs:this.fs}))
				return JSON.parse(await this.fs.promises.readFile(p,"utf8"));
		}

		let response=await this.fetch(urlJoin(this.registryUrl,packageName));
		if (response.status<200 || response.status>=300 || !response.status)
			throw new Error("Can't get package info: "+response.status);

		let data=await response.json();
		if (this.infoDir) {
			await this.fs.promises.mkdir(this.infoDir,{recursive: true});
			let p=path.join(this.infoDir,packageName);
			await this.fs.promises.writeFile(p,JSON.stringify(data));
		}

		return data;
	}

	async install(packageName, version, target) {
		if (!(await this.getSatisfyingVersion(packageName,version)))
			throw new Error("Not installable: "+packageName+" "+version);

		let packageInfo=await this.infoCache.get(packageName);
		let tarballUrl=packageInfo.versions[version].dist.tarball;
		if (this.rewriteTarballUrl)
			tarballUrl=this.rewriteTarballUrl(tarballUrl);

		await extractTar({
			url: tarballUrl,
			fetch: this.fetch,
			archiveRoot: "package",
			target: target,
			fs: this.fs
		});

		//throw new Error("work in progress");
		//console.log(tarballUrl);
	}
}
