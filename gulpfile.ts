import {configDotenv} from "dotenv";
import {MiscUtils} from "./utils/misc";
import {series} from "gulp";
import {AwsUtils} from "./utils/aws";

const readlineSync = require("readline-sync");

enum Environment {
	dev = "dev"
}

const environment = Environment.dev;
const fnToDeploy = 'GlobalResolver'
const env = configDotenv({debug: true, override: true}).parsed!;
const cfStack = 'my-app-sync';

const testUsers = [
	{email: "crusher83@gmail.com", psw: "Hello123@"},
	{email: "yury.shubin.test1@gmail.com", psw: "Hello123@"},
	{email: "yury.shubin.test2@gmail.com", psw: "Hello123@"},
];

const awsUtils = new AwsUtils(environment);

const utils = {
	chooseUser: async () =>
	{
		const users = testUsers
		.map((value, index) => `\t${index + 1} - ${value.email}`)
		.join("\n");

		const userNo = await readlineSync.question(
			`Enter a user number to use:\n${users}\n`,
		);
		if (!userNo.length) throw new Error(`cancelled`);

		const index = parseInt(userNo) - 1;
		if (index < 0) throw new Error("no user selected");

		return testUsers[index];
	}
};

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

exports.jwt_token = exports.jwt_token = async () =>
{
	const cognitoUserPoolId = await awsUtils.getCFOutputValue(
		"CognitoUserPoolId",
		cfStack,
	);
	const cognitoClientId = await awsUtils.getCFOutputValue(
		"CognitoUserPoolClientWebId",
		cfStack,
	);
	const user = await utils.chooseUser();
	await awsUtils.getJwToken(user.email, user.psw, cognitoUserPoolId, cognitoClientId);
};

exports.create_cognito_user = exports.create_user = async () =>
{
	const cognitoUserPoolId = await awsUtils.getCFOutputValue(
		"CognitoUserPoolId",
		cfStack,
	);
	const cognitoClientId = await awsUtils.getCFOutputValue(
		"CognitoUserPoolClientWebId",
		cfStack,
	);
	const user = await utils.chooseUser();
	await awsUtils.createUser(user.email, user.psw, cognitoUserPoolId, cognitoClientId);
};

exports.print = series(api.print);
exports.package = series(api.package);
exports.deploy_fn = series(api.deployFn);
exports.deploy = series(api.deploy);
exports.delete = series(api.delete);
