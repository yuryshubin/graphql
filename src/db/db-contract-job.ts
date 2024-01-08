import { Entity } from "electrodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EnvironmentManager } from "../environment-manager";

export const DbContactJob = new Entity(
  {
    model: {
      entity: "contractJob",
      version: "1",
      service: "contractJob",
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
        type: "number",
        required: true,
      },
      to: {
        type: "number"
      },
      hourlySalary: {
        type: "number",
        required: true,
      }
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
