import NpmInstaller from "./NpmInstaller.js";

export async function installDependencies(options) {
	let npmInstaller=new NpmInstaller(options);
	await npmInstaller.run();

	return {
		success: true,
		warnings: npmInstaller.warnings
	}
}