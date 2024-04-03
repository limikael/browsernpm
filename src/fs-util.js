export async function exists(fsPromises, path) {
	try {
		let stat=await fsPromises.stat(path);
		//console.log(stat);
		return true;
	} 

	catch (e) {
		if (e.code!="ENOENT")
			throw e;

		return false;
	}
}