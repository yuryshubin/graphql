import {configDotenv} from "dotenv";
import {MiscUtils} from "./utils/misc";
import {series} from "gulp";

enum Environment {
	dev = "dev"
}

const environment = Environment.dev;
const fnToDeploy = 'GlobalResolver'
const env = configDotenv({debug: true, override: true}).parsed!;

const api = {
	print: async () =>
	{
		await MiscUtils.runCmd(
			`sls print --stage ${environment} --verbose`,
		);
	},
	package: async () =>
	{
		await MiscUtils.runCmd(
			`sls package --stage ${environment} --verbose`,
		);
	},
	deploy: async () =>
	{
		await MiscUtils.runCmd(
			`sls deploy --stage ${environment} --verbose`,
		);
	},
	deployFn: async () =>
	{
		await MiscUtils.runCmd(
			`sls deploy function --function ${fnToDeploy} --stage ${environment}`,
		);
	},
	delete: async () =>
	{
		await MiscUtils.runCmd(
			`sls remove --stage ${environment}`,
		);
	},
};

exports.print = series(api.print);
exports.package = series(api.package);
exports.deploy_fn = series(api.deployFn);
exports.deploy = series(api.deploy);
exports.delete = series(api.delete);
