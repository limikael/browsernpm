import {DebugFetcher, createDebugFetch} from "../src/utils/debug-util.js";
import urlJoin from "url-join";
import {fileURLToPath} from 'url';
import path from "path";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("debug-util",()=>{
	it("can fetch with a class",async ()=>{
		let fetcher=new DebugFetcher();
		let url=urlJoin("file://",__dirname,"data/debug-util/katnip-3.0.25-info.json");

		let req=await fetcher.fetch(url);
		let data=await req.json();
		expect(data.name).toEqual("katnip");
	});

	it("can create a debug fetcher",async ()=>{
		let fetch=createDebugFetch({
			rewrite: u=>{
				if (u=="blugg")
					return urlJoin("file://",__dirname,"data/debug-util/katnip-3.0.25-info.json")

				throw new Error("unexpected url");
			}
		});

		//let url=urlJoin("file://",__dirname,"data/debug-util/katnip-3.0.25-info.json");

		let req=await fetch("blugg");
		let data=await req.json();
		expect(data.name).toEqual("katnip");
		expect(fetch.urls.length).toEqual(1);
	});
});