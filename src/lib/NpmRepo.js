import Cache from "../utils/Cache.js";
import urlJoin from "url-join";
import semver from "semver";
import path from "path-browserify";
import {exists, linkRecursive} from "../utils/fs-util.js";
import {extractTar, fetchTarReader, tarReaderMatch} from "../utils/tar-util.js";
import {ResolvablePromise, isValidUrl} from "../utils/js-util.js";

export default class NpmRepo {
	constructor({registryUrl, fetch, infoDir, fs, casDir}={}) {
		this.registryUrl=registryUrl;
		this.fetch=fetch;
		this.infoDir=infoDir;
		this.fs=fs;
		this.casDir=casDir;
		this.casDownloadPromises={};
		this.casPackageJsonPromises={};
		this.tarReaderPromises={};

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

	async getTarReader(url) {
		if (this.tarReaderPromises[url])
			return await this.tarReaderPromises[url];

		this.tarReaderPromises[url]=new ResolvablePromise();
		let tarReader=await fetchTarReader(url,{fetch: this.fetch});
		this.tarReaderPromises[url].resolve(tarReader);

		return await this.tarReaderPromises[url];
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

	// Returns serialized versions.
	async getCasVersions(packageName) {
		let keys=await this.getCasKeys();
		if (!keys)
			return [];

		let casName=this.serializePackageName(packageName);
		let versions=[];
		for (let key of keys) {
			if (key.startsWith(casName)) {
				let v=key.slice(casName.length+1);
				versions.push(v);
			}
		}

		return versions;
	}

	async _getSatisfyingCasVersion(packageName, versionSpec) {
		let casVersions=await this.getCasVersions(packageName);
		let casVer=semver.maxSatisfying(casVersions,versionSpec);
		if (casVer)
			return casVer;
	}

	async _getSatisfyingInfoVersion(packageName, versionSpec) {
		if (!semver.validRange(versionSpec))
			throw new Error("Not valid semver range: "+versionSpec);

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
		if (semver.validRange(versionSpec)) {
			let casVer=await this._getSatisfyingCasVersion(packageName,versionSpec);
			if (casVer)
				return casVer;

			return await this._getSatisfyingInfoVersion(packageName,versionSpec);
		}

		if (!isValidUrl(versionSpec))
			throw new Error("Version spec is not semver range or url: "+versionSpec);

		return versionSpec;
	}

	async getCasPackageJson(packageName, version) {
		let casKey=this.serializePackageSpec(packageName,version);
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
		let pkg;

		// Get via cas.
		let casKeys=await this.getCasKeys();
		if (casKeys) {
			let casKey=this.serializePackageSpec(packageName,version);
			if (casKeys.includes(casKey))
				pkg=await this.getCasPackageJson(packageName,version);
		}

		if (!pkg && isValidUrl(version)) {
			let tarReader=await this.getTarReader(version);
			let fn=tarReaderMatch(tarReader,"package.json")
			if (!fn)
				fn=tarReaderMatch(tarReader,"package/package.json");

			if (!fn)
				throw new Error("Not npm package, package.json not found in: "+this.versionSpec);

			pkg=JSON.parse(tarReader.getTextFile(fn));
		}

		// Get via info.
		if (!pkg && semver.valid(version)) {
			let packageInfo=await this.infoCache.get(packageName);
			if (!packageInfo)
				throw new Error("Unknown package version: "+packageName+" "+version);

			pkg=packageInfo.versions[version];
		}

		if (!pkg)
			throw new Error("Can't find package: "+packageName+" "+version);

		let deps=pkg.dependencies;
		if (!deps)
			return {};

		return deps;
	}

	async removePackageInfo(packageName) {
		if (this.infoDir) {
			let p=path.join(this.infoDir,this.serializePackageName(packageName));
			await this.fs.promises.rm(p,{force: true});
		}
	}

	serializePackageName(name) {
		return name.replaceAll("/","+");
	}

	serializePackageVersion(version) {
		if (semver.valid(version))
			return version;

		if (isValidUrl(version))
			return version.replaceAll("/","+").replaceAll("@","+").replaceAll(":","+");

		throw new Error("Not semver or url: "+version);
	}

	serializePackageSpec(name, version) {
		return this.serializePackageName(name)+"@"+this.serializePackageVersion(version);
	}

	async loadPackageInfo(packageName) {
		if (this.infoDir) {
			let p=path.join(this.infoDir,this.serializePackageName(packageName));
			if (await exists(p,{fs:this.fs}))
				return JSON.parse(await this.fs.promises.readFile(p,"utf8"));
		}

		let response=await this.fetch(urlJoin(this.registryUrl,packageName));
		if (response.status<200 || response.status>=300 || !response.status)
			throw new Error("Can't get package info: "+response.status);

		let data=await response.json();
		if (this.infoDir) {
			await this.fs.promises.mkdir(this.infoDir,{recursive: true});
			let p=path.join(this.infoDir,this.serializePackageName(packageName));
			await this.fs.promises.writeFile(p,JSON.stringify(data));
		}

		return data;
	}

	async downloadPackage(packageName, version, target) {
		let tarReader;
		if (isValidUrl(version)) {
			if (this.tarReaderPromises[version])
				tarReader=await this.tarReaderPromises[version];

			else
				tarReader=await fetchTarReader(url,{fetch: this.fetch});
		}

		else {
			if (!(await this._getSatisfyingInfoVersion(packageName,version)))
				throw new Error("Not installable: "+packageName+" "+version);

			let packageInfo=await this.infoCache.get(packageName);
			let tarballUrl=packageInfo.versions[version].dist.tarball;
			tarReader=await fetchTarReader(tarballUrl,{
				fetch: this.fetch
			});
		}

		//await this.fs.promises.rm(target,{recursive: true, force: true});
		await extractTar({
			tarReader: tarReader,
			archiveRoot: "package",
			target: target,
			fs: this.fs
		});

		let pkgPath=path.join(target,"package.json");
		let pkgText=await this.fs.promises.readFile(pkgPath,"utf8");
		let pkg=JSON.parse(pkgText);

		pkg.__installedVersion=version;
		await this.fs.promises.writeFile(pkgPath,JSON.stringify(pkg,null,2));
	}

	async install(packageName, version, target) {
		let casKeys=await this.getCasKeys();
		if (casKeys) {
			let casKey=this.serializePackageSpec(packageName,version);
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
			//await this.fs.promises.mkdir(path.dirname(target),{recursive: true});
			//await this.fs.promises.rm(target,{recursive: true, force: true});
			await linkRecursive(casPackagePath,target,{fs:this.fs});
		}

		else {
			await this.downloadPackage(packageName,version,target);
		}
	}
}
