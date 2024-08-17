import {ResolvablePromise} from "./js-util.js";

class SemaphoreTask {
	constructor(semaphore) {
		this.semaphore=semaphore;
		this.promise=new ResolvablePromise();
		this.completed=false;
	}

	run() {
		this.promise.resolve(()=>this.complete());
	}

	complete() {
		if (!this.completed) {
			this.completed=true;
			this.semaphore.taskComplete(this);
		}
	}
}

export default class Semaphore {
	constructor() {
		this.queue=[];
	}

	taskComplete(task) {
		if (task!=this.queue[0])
			throw new Error("wrong task");

		this.queue.shift();

		if (this.queue.length)
			this.queue[0].run();
	}

	aquire() {
		let task=new SemaphoreTask(this);
		this.queue.push(task);

		if (this.queue.length==1)
			this.queue[0].run();

		return task.promise;
	}

	async critical(fn) {
		let release=await this.aquire();
		try {
			let res=await fn();
			release();
			return res;
		}

		catch (e) {
			release();
			throw e;
		}
	}
}