import { Entity } from "electrodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EnvironmentManager } from "../environment-manager";

export const DbFullTimeJob = new Entity(
  {
    model: {
      entity: "fullTimeJob",
      version: "1",
      service: "fullTimeJob",
    },
    attributes: {
      userId: {
        type: "string",
        required: true,
      },
      jobId: {
        type: "string",
        required: true,
      },
      company: {
        type: "string",
        required: true,
      },
      from: {
        type: "string",
        required: true,
      },
      to: {
        type: "string",
      },
      pensionPlan: {
        type: "boolean",
        required: true,
      },
      yearlySalary: {
        type: "number",
        required: true,
      },
    },
    indexes: {
      byUser: {
        pk: {
          field: "PK",
          composite: ["userId"],
        },
        sk: {
          field: "SK",
          composite: ["jobId"],
        },
      },
    },
  },
  {
    client: new DynamoDBClient(),
    table: EnvironmentManager.getDb(),
    logger: (event) => console.log(event),
  },
);
