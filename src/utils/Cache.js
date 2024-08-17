import Semaphore from "./Semaphore.js";

class CacheResource {
	constructor(key, cache) {
		this.key=key;
		this.cache=cache;
		this.semaphore=new Semaphore();
	}

	get() {
		if (this.dataPromise)
			return this.dataPromise;

		this.dataPromise=this.semaphore.critical(async ()=>{
			return await this.cache.getter(this.key);
		});

		return this.dataPromise;
	}

	invalidate() {
		if (!this.dataPromise)
			return;

		this.dataPromise=null;
		return this.semaphore.critical(async ()=>{
			await this.cache.invalidator(this.key);
		});
	}
}

export default class Cache {
	constructor({getter, invalidator}) {
		this.getter=getter;
		this.invalidator=invalidator;
		this.resources={};
	}

	async get(key) {
		if (!this.resources[key])
			this.resources[key]=new CacheResource(key, this);

		return await this.resources[key].get();
	}

	async invalidate(key) {
		if (!this.resources[key])
			return;

		await this.resources[key].invalidate();
	}
}