import { GraphQLInput } from "./graphql-input";
import { DbUser } from "./db";
import { EntityRecord } from "electrodb";
import * as crypto from "crypto";
import { DbFullTimeJob, DbContactJob } from "./db";

enum JobType {
  FullTimeJob = "FullTimeJob",
  ContractJob = "ContractJob",
}

// https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference-js.html
// excluding sub items
const group = <
  T extends typeof DbUser | typeof DbFullTimeJob | typeof DbContactJob,
>(
  event: GraphQLInput,
  entity: T,
) => {
  const existingSet = new Set(Object.keys(entity.schema.attributes));
  const selectionSetListSet = new Set(event.selectionSetList);
  const foundSet = new Set(
    [...existingSet].filter((x) => selectionSetListSet.has(x)),
  );
  const missingSet = new Set(
    [...selectionSetListSet].filter((x) => !existingSet.has(x)),
  );
  const foundKeys = Array.from(foundSet);
  const otherKeys = Array.from(missingSet);
  console.info(`foundKeys`, foundKeys);
  console.info(`otherKeys`, otherKeys);
  return { foundKeys, otherKeys };
};

const fragment = (text: string) => {
  const components = text.split("\n").map((v) => v.replace("\n", ""));
  // console.info(components);

  let items: string[][] = [];
  let content: string[] = [];
  const targetLevel = 2;
  let currentLevel = 0;

  for (const v of components) {
    if (v.includes("{")) {
      currentLevel++;

      // console.info(`${currentLevel} - ${v}`);
      if (currentLevel === targetLevel) {
        content.push(v);
      }
    } else if (v.includes("}")) {
      // console.info(`${currentLevel} - ${v}`);

      if (currentLevel === targetLevel) {
        content.push(v);
        items.push(content);
        content = [];
      }

      currentLevel--;
    } else {
      if (currentLevel === targetLevel) content.push(v);
    }
  }
  // console.info("items...");
  // items.forEach((item) => console.info(item));
  // console.info("next..");

  const info: Record<string, string[]> = {};
  items.forEach((item) => {
    const entity = item[0].split(" ")[4];
    // console.info(`entity: ${entity}`);

    const values = [];
    for (let i = 1; i < item.length - 1; ++i)
      values.push(item[i].replaceAll(" ", ""));

    info[entity] = values;
  });
  // console.info("final", info);
  return info;
};

const createUser = async (event: GraphQLInput) => {
  const params = event.args.input as Record<string, any>;
  params["userId"] = crypto.randomUUID();
  console.info("createUser...", params);

  const response = await DbUser.put(params as any).go();
  console.info(`response`, JSON.stringify(response, null, 2));
  const entity = response.data as EntityRecord<typeof DbUser>;
  console.info(`entity`, JSON.stringify(entity, null, 2));

  if (!entity) throw new Error(`Internal error`);

  return entity;
};

const getUsers = async (event: GraphQLInput) => {
  console.info("getUsers...");
  const selectionSetList = group(event, DbUser).foundKeys;

  const expressionAttributeNames: Record<string, string> = {
    "#PK": "PK",
    "#SK": "SK",
    "#__edb_e__": "__edb_e__",
    "#__edb_v__": "__edb_v__",
  };

  selectionSetList.forEach((value) => {
    expressionAttributeNames[`#${value}`] = value;
  });

  //const projectionExpression = "PK,SK,#__edb_e__,#__edb_v__";
  const projectionExpression = [
    "PK",
    "SK",
    "#__edb_e__",
    "#__edb_v__",
    ...selectionSetList.map((value) => `#${value}`),
  ].join(",");

  const response = await DbUser.scan.go({
    params: {
      ProjectionExpression: projectionExpression,
      ExpressionAttributeNames: expressionAttributeNames,
    },
  });
  console.info(`response`, JSON.stringify(response, null, 2));
  const entities = response.data as EntityRecord<typeof DbUser>[];
  console.info(`entities`, JSON.stringify(entities, null, 2));

  return entities;
};

const getUser = async (event: GraphQLInput) => {
  const userId = event.args.input["userId"];
  console.info("getUser...", userId);

  const response = await DbUser.query
    .byUser({ userId })
    .go({ limit: 1, select: event.selectionSetList });
  console.info(`response`, JSON.stringify(response, null, 2));
  const entities = response.data as EntityRecord<typeof DbUser>[];
  console.info(`entities`, JSON.stringify(entities, null, 2));

  if (!entities.length) throw new Error(`No user found for ${userId}`);

  return entities[0];
};

const addFullTimeJob = async (event: GraphQLInput) => {
  const params = event.args.input as Record<string, any>;
  params["jobId"] = crypto.randomUUID();

  console.info("create FullTimeJob...", params);

  const response = await DbFullTimeJob.put(params as any).go();
  console.info(`response`, JSON.stringify(response, null, 2));
  const entity = response.data as EntityRecord<typeof DbFullTimeJob>;
  console.info(`entity`, JSON.stringify(entity, null, 2));

  if (!entity) throw new Error(`Internal error`);

  return entity;
};

const addContractJob = async (event: GraphQLInput) => {
  const params = event.args.input as Record<string, any>;
  params["jobId"] = crypto.randomUUID();

  console.info("create ContractJob...", params);

  const response = await DbContactJob.put(params as any).go();
  console.info(`response`, JSON.stringify(response, null, 2));
  const entity = response.data as EntityRecord<typeof DbContactJob>;
  console.info(`entity`, JSON.stringify(entity, null, 2));

  if (!entity) throw new Error(`Internal error`);

  return entity;
};

const getJobsByUserIdInternal = async (
  userId: string,
  selectionSetList: string[],
  selectionSetGraphQL: string,
) => {
  console.info("getJobs...", userId);
  const fragments = fragment(selectionSetGraphQL);
  console.info(`selectionSetList`, JSON.stringify(selectionSetList, null, 2));
  console.info(`fragments`, JSON.stringify(fragments, null, 2));

  const results = [];

  // case 1
  if (selectionSetList.length || fragments[JobType.FullTimeJob]?.length) {
    const extras1 = fragments[JobType.FullTimeJob] || [];
    const response1 = await DbFullTimeJob.query
      .byUser({ userId })
      .go({ limit: 10, select: selectionSetList.concat(...extras1) });
    console.info(`response full time jobs`, JSON.stringify(response1, null, 2));
    const entities1 = response1.data as EntityRecord<typeof DbFullTimeJob>[];
    entities1.forEach((x) => {
      (x as Record<string, any>)["__typename"] = JobType.FullTimeJob;
    });
    console.info(`entities full time jobs`, JSON.stringify(entities1, null, 2));
    results.push(...entities1);
  }

  // case 2
  if (selectionSetList.length || fragments[JobType.ContractJob]?.length) {
    const extras2 = fragments[JobType.ContractJob] || [];
    const response2 = await DbContactJob.query
      .byUser({ userId })
      .go({ limit: 10, select: selectionSetList.concat(...extras2) });
    console.info(`response contract jobs`, JSON.stringify(response2, null, 2));
    const entities2 = response2.data as EntityRecord<typeof DbContactJob>[];
    entities2.forEach((x) => {
      (x as Record<string, any>)["__typename"] = JobType.ContractJob;
    });
    console.info(`entities contract jobs`, JSON.stringify(entities2, null, 2));
    results.push(...entities2);
  }

  console.info(`results`, JSON.stringify(results, null, 2));
  return results;
};

const getJobsByUserIdParam = async (event: GraphQLInput) => {
  console.info("getJobsByUserIdParam");
  const params = event.args.input as Record<string, any>;
  return await getJobsByUserIdInternal(
    params.userId,
    event.selectionSetList,
    event.selectionSetGraphQL,
  );
};

const getJobsByUserId = async (event: GraphQLInput) => {
  console.info("getJobsByUserId");
  const userId = (event.source as EntityRecord<typeof DbUser>).userId;
  return await getJobsByUserIdInternal(
    userId,
    event.selectionSetList,
    event.selectionSetGraphQL,
  );
};

export const handler = async (event: GraphQLInput, context: any) => {
  console.log("event:", JSON.stringify(event, null, 2));
  // console.log("context:", JSON.stringify(context, null, 2));

  try {
    switch (event.fieldName) {
      case "getUsers":
        return getUsers(event);
      case "getUser":
        return getUser(event);
      case "createUser":
        return createUser(event);
      case "addFullTimeJob":
        return addFullTimeJob(event);
      case "addContractJob":
        return addContractJob(event);
      case "getJobs":
        return getJobsByUserIdParam(event);
      case "jobs":
        return getJobsByUserId(event);
    }
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify(e) };
  }
};
