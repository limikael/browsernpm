import path from "path-browserify";

export async function exists(path, {fs}) {
	try {
		let stat=await fs.promises.stat(path);
		//console.log(stat);
		return true;
	} 

	catch (e) {
		if (e.code!="ENOENT")
			throw e;

		return false;
	}
}

export async function mkdirRecursive(dir, {fs}) {	
	let start="";
	if (path.isAbsolute(dir))
		start=path.sep;

	let parts=dir.split(path.sep);
	for (let i=0; i<=parts.length; i++) {
		let p=path.join(start,...parts.slice(0,i));
		if (!(await exists(p,{fs}))) {
			try {
				await fs.promises.mkdir(p);
			}

			catch (e) {
				if (e.code!="EEXIST")
					throw e;
			}
		}
	}
}