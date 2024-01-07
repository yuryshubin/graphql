export class EnvironmentManager {
	static getDb() {
		return process.env.DATABASE!;
	}
}
