import {Logger} from "@aws-lambda-powertools/logger";
import {LogLevel} from "@aws-lambda-powertools/logger/lib/types";

export const logger = new Logger({serviceName: "graphql"});

export const setupLoggerBase = (
	level: LogLevel,
	method: string,
	path: string,
	stage: string,
) =>
{
	logger.setLogLevel(level);
	logger.setPersistentLogAttributes({
		method,
		path,
		stage,
	});
};
