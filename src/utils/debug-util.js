import fs from "fs";

//let s=new ReadableStream({start(c){c.enqueue("bla");c.close()}});
export class DebugResponse {
	constructor(data) {
		this._data=data;
		this.status=200;

		this.body=new ReadableStream({
			start(c) {
				c.enqueue(data);
				c.close()
			}
		});
	}

	async json() {
		return JSON.parse(this._data);
	}
}

export class DebugFetcher {
	constructor({rewrite}={}) {
		this.rewrite=rewrite;
		this.urls=[];
	}

	async fetch(url) {
		if (this.rewrite)
			url=this.rewrite(url);

		this.urls.push(url);
		let u=new URL(url);
		if (u.protocol!="file:")
			throw new Error("Expected file url for debug fetch.");

		return new DebugResponse(await fs.promises.readFile(u.pathname));
	}
}

export function createDebugFetch(options) {
	let fetcher=new DebugFetcher(options);

	function fetch(url) {
		return fetcher.fetch(url)
	}

	fetch.urls=fetcher.urls;

	return fetch;
}