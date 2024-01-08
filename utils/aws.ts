import { fromIni } from "@aws-sdk/credential-providers";
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { Lambda } from "@aws-sdk/client-lambda";
import { ApiGatewayV2 } from "@aws-sdk/client-apigatewayv2";
import { PolicyDocument } from "aws-lambda";

const readlineSync = require("readline-sync");

export class AwsUtils {
  readonly awsAccountId: string;
  readonly awsProfile: string;
  readonly awsRegion: string;
  readonly environment: string;

  constructor(environment: string) {
    this.awsAccountId = process.env["AWS_ACCOUNT"]!;
    this.awsProfile = process.env["AWS_PROFILE"]!;
    this.awsRegion = process.env["AWS_REGION"]!;
    this.environment = environment;
  }

  async getCFOutputValue(key: string, cfStackName: string): Promise<string> {
    const cf = new CloudFormationClient({
      credentials: fromIni({ profile: this.awsProfile }),
      region: this.awsRegion,
    });
    const stackName = `${this.environment}-${cfStackName}`;
    const output = await cf.send(
      new DescribeStacksCommand({ StackName: stackName }),
    );
    if (!output.Stacks!.length)
      throw new Error(`Stack "${stackName}" not found`);

    const value = output.Stacks![0].Outputs?.find(
      (value) => value.OutputKey === key,
    )?.OutputValue;

    if (!value)
      throw new Error(`output key "${key}" not found in "${stackName}"`);

    return value;
  }

  async createUser(
    email: string,
    password: string,
    cognitoUserPoolId: string,
    cognitoClientId: string,
  ) {
    const client = new CognitoIdentityProviderClient({
      credentials: fromIni({ profile: this.awsProfile }),
      region: this.awsRegion,
    });

    const signupCmd = new SignUpCommand({
      ClientId: cognitoClientId,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: "name", Value: email.split("@")[0] }],
      ClientMetadata: { role: "user" },
    });

    const signUpResponse = await client.send(signupCmd);
    console.info("signUpResponse", signUpResponse);

    const code = await readlineSync.question(
      "Enter confirmation code sent by email:\n",
    );

    if (!code.length) throw new Error(`cancelled`);

    const confirmSignupCmd = new ConfirmSignUpCommand({
      ClientId: cognitoClientId,
      Username: email,
      ConfirmationCode: code,
      ClientMetadata: { role: "user" },
    });
    const confirmSignupResponse = await client.send(confirmSignupCmd);
    console.info("confirmSignupResponse", confirmSignupResponse);
  }

  async getJwToken(
    email: string,
    password: string,
    cognitoUserPoolId: string,
    cognitoClientId: string,
  ) {
    const cmd = new AdminInitiateAuthCommand({
      UserPoolId: cognitoUserPoolId,
      ClientId: cognitoClientId,
      AuthFlow: "ADMIN_NO_SRP_AUTH",
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });
    const client = new CognitoIdentityProviderClient({
      credentials: fromIni({ profile: this.awsProfile }),
      region: this.awsRegion,
    });
    const authResult = await client.send(cmd);
    console.debug(`auth result:`, authResult);
    if (authResult.ChallengeName == "NEW_PASSWORD_REQUIRED") {
      const cmd = new AdminRespondToAuthChallengeCommand({
        UserPoolId: cognitoUserPoolId,
        ClientId: cognitoClientId,
        Session: authResult.Session,
        ChallengeName: authResult.ChallengeName,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: password,
        },
      });
      const challengeResult = await client.send(cmd);
      console.debug(`challenge result:`, challengeResult);
      console.info(
        `JWT Token is: "Bearer ${
          challengeResult.AuthenticationResult!.AccessToken
        }"`,
      );
    } else {
      console.info(
        `JWT Token is: "Bearer ${
          authResult.AuthenticationResult!.AccessToken
        }"`,
      );
    }
  }

  async updateLambdaPermissionForApiGW(apiId: string) {
    const removeLambdaPermissions = async (fnArn: string) => {
      const lambda = new Lambda();

      try {
        const policy = await lambda.getPolicy({ FunctionName: fnArn });
        // console.debug(`policy: `, policy);
        if (policy.Policy) {
          const document = JSON.parse(policy.Policy) as PolicyDocument;
          for (const statement of document.Statement) {
            const result = await lambda.removePermission({
              FunctionName: fnArn,
              StatementId: statement.Sid,
            });
          }
        }
      } catch {}
    };
    const addLambdaPermissions = async (fnArn: string, srcArn: string) => {
      let counter = 1;
      const lambda = new Lambda();
      const result = await lambda.addPermission({
        FunctionName: fnArn,
        StatementId: `sid_${counter}`,
        Action: "lambda:InvokeFunction",
        Principal: "apigateway.amazonaws.com",
        SourceArn: srcArn,
      });
      console.info(`adding permission for: `, fnArn);
    };

    const apiGW = new ApiGatewayV2();
    const routes = await apiGW.getRoutes({ ApiId: apiId });
    console.info(`routes received: `, routes.Items?.length);

    for (const item of routes.Items || []) {
      console.info(`processing route item: `, item.RouteKey);

      const route = await apiGW.getRoute({
        ApiId: apiId,
        RouteId: item.RouteId,
      });
      if (!route.Target) continue;

      const integrationComponents = route.Target.split("/");
      const integrationId = integrationComponents[1];
      const integration = await apiGW.getIntegration({
        ApiId: apiId,
        IntegrationId: integrationId,
      });

      const uri = integration.IntegrationUri;
      if (!uri) continue;

      const urlComponents = uri.split("/");
      const functionArn = urlComponents[urlComponents.length - 2];

      if (!route.RouteKey) continue;

      const routeKeyComponents = route.RouteKey.split(" ");
      if (routeKeyComponents.length != 2) continue;

      const path = routeKeyComponents[1];
      const sourceArn = `arn:aws:execute-api:${this.awsRegion}:${this.awsAccountId}:${apiId}/*/*${path}`;
      console.info(
        `function arn: ${functionArn} path: ${path} sourceArn: ${sourceArn}`,
      );

      await removeLambdaPermissions(functionArn);
      await addLambdaPermissions(functionArn, sourceArn);
    }
  }
}
