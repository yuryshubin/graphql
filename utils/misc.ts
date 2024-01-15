import { exec } from "child_process";
import * as fs from "fs";

export class MiscUtils {
  static async runCmd(cmd: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let buffer = "";
      const proc = exec(cmd, { env: process.env }, (err: any) => {
        err ? reject(err) : resolve(buffer);
      });
      proc.stdout?.on("data", (data: any) => (buffer += data));
      proc.stdout?.pipe(process.stdout);
      proc.stderr?.pipe(process.stderr);
    });
  }
}
