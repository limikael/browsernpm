import NpmInstaller from "./NpmInstaller.js";

export async function installDependencies(options) {
	let npmInstaller=new NpmInstaller(options);
	return await npmInstaller.run();
}