import NpmInstaller from "./NpmInstaller.js";
export {fetchTarReader, extractTar} from "../utils/tar-util.js";

export async function installDependencies(options) {
	let npmInstaller=new NpmInstaller(options);
	return await npmInstaller.run();
}