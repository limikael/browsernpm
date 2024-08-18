import Cache from "../utils/Cache.js";
import urlJoin from "url-join";
import semver from "semver";
import path from "path-browserify";
import {exists, linkRecursive} from "../utils/fs-util.js";
import {extractTar} from "../utils/tar-util.js";
import {ResolvablePromise} from "../utils/js-util.js";

export default class NpmRepo {
	constructor({registryUrl, fetch, infoDir, fs, rewriteTarballUrl, casDir}={}) {
		this.registryUrl=registryUrl;
		this.fetch=fetch;
		this.infoDir=infoDir;
		this.fs=fs;
		this.rewriteTarballUrl=rewriteTarballUrl;
		this.casDir=casDir;
		this.casDownloadPromises={};
		this.casPackageJsonPromises={};

		if (!this.fs)
			throw new Error("NpmRepo need fs");

		if (!this.registryUrl)
			this.registryUrl="https://registry.npmjs.org/"

		if (!this.fetch)
			this.fetch=globalThis.fetch.bind(globalThis);

		this.infoCache=new Cache({
			getter: key=>this.loadPackageInfo(key),
			invalidator: key=>this.removePackageInfo(key)
		});
	}

	async getCasKeys() {
		if (!this.casDir)
			return;

		if (this.casKeysPromise)
			return this.casKeysPromise;

		this.casKeysPromise=new ResolvablePromise();
		let keys=[];
		if (await exists(this.casDir,{fs:this.fs})) {
			for (let cand of await this.fs.promises.readdir(this.casDir))
				if (!cand.endsWith(".part"))
					keys.push(cand);
		}

		this.casKeysPromise.resolve(keys);
		return this.casKeysPromise;
	}

	parseCasKey(key) {
		return key.split("@");
	}

	async getCasVersions(packageName) {
		let keys=await this.getCasKeys();
		if (!keys)
			return [];

		let versions=[];
		for (let key of keys) {
			let [n,v]=this.parseCasKey(key);
			if (n==packageName)
				versions.push(v);
		}

		return versions;
	}

	async getSatisfyingCasVersion(packageName, versionSpec) {
		let casVersions=await this.getCasVersions(packageName);
		let casVer=semver.maxSatisfying(casVersions,versionSpec);
		if (casVer)
			return casVer;
	}

	async getSatisfyingInfoVersion(packageName, versionSpec) {
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

	async getSatisfyingVersion(packageName, versionSpec) {
		let casVer=await this.getSatisfyingCasVersion(packageName,versionSpec);
		if (casVer)
			return casVer;

		return await this.getSatisfyingInfoVersion(packageName,versionSpec);
	}

	async getCasPackageJson(packageName, version) {
		let casKey=packageName+"@"+version;
		if (this.casPackageJsonPromises[casKey])
			return await this.casPackageJsonPromises[casKey];

		this.casPackageJsonPromises[casKey]=new ResolvablePromise();

		//console.log("loading package.json from cas");
		let casPackagePath=path.join(this.casDir,casKey);
		let pkgJsonPath=path.join(casPackagePath,"package.json");
		let pkgJson=await this.fs.promises.readFile(pkgJsonPath)
		let pkg=JSON.parse(pkgJson);

		this.casPackageJsonPromises[casKey].resolve(pkg); //=new ResolvablePromise();
		return await this.casPackageJsonPromises[casKey];
	}

	async getVersionDependencies(packageName, version) {
		// Get via cas. todo: cache the package.json files?
		let casKeys=await this.getCasKeys();
		if (casKeys) {
			let casKey=packageName+"@"+version;
			if (casKeys.includes(casKey)) {
				let pkg=await this.getCasPackageJson(packageName,version);
				let deps=pkg.dependencies;
				if (!deps)
					return {};

				return deps;
			}
		}

		// Get via info.
		let packageInfo=await this.infoCache.get(packageName);
		if (!packageInfo)
			throw new Error("Unknown package version: "+packageName+" "+version);

		let pkg=packageInfo.versions[version];
		let deps=pkg.dependencies;
		if (!deps)
			return {};

		return deps;
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

	async downloadPackage(packageName, version, target) {
		if (!(await this.getSatisfyingInfoVersion(packageName,version)))
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

	async install(packageName, version, target) {
		let casKeys=await this.getCasKeys();
		if (casKeys) {
			let casKey=packageName+"@"+version;
			let casPackagePath=path.join(this.casDir,casKey);

			// Put in CAS
			if (!casKeys.includes(casKey)) {
				casKeys.push(casKey);
				this.casDownloadPromises[casKey]=new ResolvablePromise();

				let casPartPath=path.join(this.casDir,casKey+".part");
				if (await exists(casPartPath,{fs:this.fs}))
					await this.fs.promises.rm(casPartPath,{recursive: true});

				await this.downloadPackage(packageName,version,casPartPath);
				await this.fs.promises.rename(casPartPath,casPackagePath);

				this.casDownloadPromises[casKey].resolve();
			}

			if (this.casDownloadPromises[casKey])
				await this.casDownloadPromises[casKey];

			// Install from CAS
			await this.fs.promises.mkdir(path.dirname(target),{recursive: true});
			await linkRecursive(casPackagePath,target,{fs:this.fs});
		}

		else {
			await this.downloadPackage(packageName,version,target);
		}
	}
}
